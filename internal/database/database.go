package database

import (
	"database/sql"
	"fmt"
	"log/slog"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type DB struct {
	*sql.DB
}

// Open connects to PostgreSQL and runs pending migrations.
func Open(dsn string) (*DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	if err := runMigrations(db); err != nil {
		db.Close()
		return nil, err
	}

	return &DB{db}, nil
}

func runMigrations(db *sql.DB) error {
	// Advisory lock prevents concurrent migration races
	if _, err := db.Exec("SELECT pg_advisory_lock(1)"); err != nil {
		return fmt.Errorf("advisory lock: %w", err)
	}
	defer db.Exec("SELECT pg_advisory_unlock(1)")

	// Create version tracking table
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_version (
			version    INTEGER PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`); err != nil {
		return fmt.Errorf("create schema_version: %w", err)
	}

	// Get current version
	var current int
	db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&current)

	// Run pending migrations
	for i := current; i < len(migrations); i++ {
		version := i + 1
		slog.Info("running migration", "version", version)
		if _, err := db.Exec(migrations[i]); err != nil {
			return fmt.Errorf("migration %d failed: %w", version, err)
		}
		if _, err := db.Exec("INSERT INTO schema_version (version) VALUES ($1)", version); err != nil {
			return fmt.Errorf("record migration %d: %w", version, err)
		}
	}

	if current < len(migrations) {
		slog.Info("migrations complete", "from", current, "to", len(migrations))
	}
	return nil
}
