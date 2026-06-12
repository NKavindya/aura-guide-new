package api

import (
	"encoding/json"
	"net/http"

	"aura-backend/common/middleware"
	"aura-backend/notification-module/service"
)

func GetDailyTaskReminderHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := r.Context().Value(middleware.UserEmailKey).(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	response, err := service.GetDailyTaskReminder(r.Context(), email)
	if err != nil {
		http.Error(w, "Error fetching reminder", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func GetMotivationalQuoteHandler(w http.ResponseWriter, r *http.Request) {
	response := service.GetMotivationalQuote()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func ListNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := r.Context().Value(middleware.UserEmailKey).(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	items, err := service.SyncAndList(r.Context(), email)
	if err != nil {
		http.Error(w, "Error fetching notifications", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"notifications": items})
}

func MarkAllReadHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := r.Context().Value(middleware.UserEmailKey).(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if err := service.MarkAllRead(r.Context(), email); err != nil {
		http.Error(w, "Error updating notifications", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "ok"})
}
