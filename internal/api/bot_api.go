package api

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/openilink/openilink-hub/internal/database"
	"github.com/openilink/openilink-hub/internal/provider"
)

// generateTraceID creates a random trace ID with the "tr_" prefix.
func generateTraceID() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "tr_" + hex.EncodeToString(b)
}

// handleBotAPISend handles POST /bot/v1/messages/send.
func (s *Server) handleBotAPISend(w http.ResponseWriter, r *http.Request) {
	inst := installationFromContext(r.Context())
	if inst == nil {
		botAPIError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Check scope
	if !s.requireScope(inst, "messages.send") {
		botAPIError(w, "missing scope: messages.send", http.StatusForbidden)
		return
	}

	// Parse request body
	var req struct {
		To       string `json:"to"`
		Type     string `json:"type"`
		Content  string `json:"content"`
		URL      string `json:"url"`
		Base64   string `json:"base64"`
		FileName string `json:"filename"`
		TraceID  string `json:"trace_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		botAPIError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.To == "" {
		botAPIError(w, "to is required", http.StatusBadRequest)
		return
	}

	if req.Type == "" {
		req.Type = "text"
	}

	if req.Type == "text" && req.Content == "" {
		botAPIError(w, "content is required for text messages", http.StatusBadRequest)
		return
	}

	if req.Type != "text" && req.Content == "" && req.URL == "" && req.Base64 == "" {
		botAPIError(w, "content, url, or base64 is required", http.StatusBadRequest)
		return
	}

	// Generate trace ID if not provided
	traceID := req.TraceID
	if traceID == "" {
		traceID = r.Header.Get("X-Trace-Id")
	}
	if traceID == "" {
		traceID = generateTraceID()
	}

	// Get the bot instance
	botInst, ok := s.BotManager.GetInstance(inst.BotID)
	if !ok {
		// Check if bot exists and status
		bot, err := s.DB.GetBot(inst.BotID)
		if err != nil {
			botAPIError(w, "bot not found", http.StatusNotFound)
			return
		}
		if bot.Status == "session_expired" {
			botAPIError(w, "bot session expired", http.StatusServiceUnavailable)
			return
		}
		botAPIError(w, "bot not connected", http.StatusServiceUnavailable)
		return
	}

	// Auto-fill context_token from latest message if not available
	contextToken := s.DB.GetLatestContextToken(inst.BotID)

	// Build outbound message
	outMsg := provider.OutboundMessage{
		Recipient:    req.To,
		ContextToken: contextToken,
	}

	itemType := req.Type
	if req.Type == "text" {
		outMsg.Text = req.Content
	} else {
		// Media message: resolve data from base64, url, or content
		var mediaData []byte
		if req.Base64 != "" {
			var decErr error
			mediaData, decErr = base64Decode(req.Base64)
			if decErr != nil {
				botAPIError(w, "invalid base64: "+decErr.Error(), http.StatusBadRequest)
				return
			}
		} else if req.URL != "" {
			var dlErr error
			mediaData, dlErr = downloadURL(r.Context(), req.URL)
			if dlErr != nil {
				botAPIError(w, "download failed: "+dlErr.Error(), http.StatusBadGateway)
				return
			}
		} else {
			// Fallback: send content as text
			outMsg.Text = req.Content
			itemType = "text"
		}
		if mediaData != nil {
			outMsg.Data = mediaData
			outMsg.FileName = req.FileName
			if outMsg.FileName == "" {
				outMsg.FileName = "file"
			}
		}
	}

	clientID, err := botInst.Send(r.Context(), outMsg)
	if err != nil {
		slog.Error("bot api: send failed", "bot_id", inst.BotID, "err", err)
		botAPIError(w, "send failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	// Save outbound message to DB
	item := map[string]any{"type": itemType}
	if outMsg.Text != "" {
		item["text"] = outMsg.Text
	}
	if outMsg.FileName != "" {
		item["file_name"] = outMsg.FileName
	}
	itemList, _ := json.Marshal([]any{item})
	s.DB.SaveMessage(&database.Message{
		BotID:       inst.BotID,
		Direction:   "outbound",
		ToUserID:    req.To,
		MessageType: 2,
		ItemList:    itemList,
	})

	// Respond
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"ok":        true,
		"client_id": clientID,
		"trace_id":  traceID,
	})
}

// handleBotAPIContacts handles GET /bot/v1/contacts.
func (s *Server) handleBotAPIContacts(w http.ResponseWriter, r *http.Request) {
	inst := installationFromContext(r.Context())
	if inst == nil {
		botAPIError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Check scope
	if !s.requireScope(inst, "contacts.read") {
		botAPIError(w, "missing scope: contacts.read", http.StatusForbidden)
		return
	}

	contacts, err := s.DB.ListRecentContacts(inst.BotID, 100)
	if err != nil {
		slog.Error("bot api: list contacts failed", "bot_id", inst.BotID, "err", err)
		botAPIError(w, "failed to list contacts", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"ok":       true,
		"contacts": contacts,
	})
}

// handleBotAPIBotInfo handles GET /bot/v1/bot.
func (s *Server) handleBotAPIBotInfo(w http.ResponseWriter, r *http.Request) {
	inst := installationFromContext(r.Context())
	if inst == nil {
		botAPIError(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Check scope
	if !s.requireScope(inst, "bot.read") {
		botAPIError(w, "missing scope: bot.read", http.StatusForbidden)
		return
	}

	bot, err := s.DB.GetBot(inst.BotID)
	if err != nil {
		slog.Error("bot api: get bot failed", "bot_id", inst.BotID, "err", err)
		botAPIError(w, "bot not found", http.StatusNotFound)
		return
	}

	// Get live status from manager if available
	status := bot.Status
	if botInst, ok := s.BotManager.GetInstance(inst.BotID); ok {
		status = botInst.Status()
	}

	// Build response — exclude sensitive fields like credentials
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"ok": true,
		"bot": map[string]any{
			"id":         bot.ID,
			"name":       bot.Name,
			"provider":   bot.Provider,
			"status":     status,
			"msg_count":  bot.MsgCount,
			"created_at": bot.CreatedAt,
			"updated_at": bot.UpdatedAt,
		},
	})
}

// handleBotAPINotFound returns a 404 for unknown Bot API paths.
func (s *Server) handleBotAPINotFound(w http.ResponseWriter, r *http.Request) {
	_ = time.Now() // ensure time import used
	botAPIError(w, "unknown endpoint", http.StatusNotFound)
}

func base64Decode(s string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(s)
}

func downloadURL(ctx context.Context, url string) ([]byte, error) {
	dlCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(dlCtx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(io.LimitReader(resp.Body, 20*1024*1024))
}
