package api

import (
	"encoding/json"
	"net/http"

	"aura-backend/common/middleware"
	"aura-backend/user-module"
	"aura-backend/user-module/service"

	"github.com/go-chi/chi/v5"
)

func GetUserHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := r.Context().Value(middleware.UserEmailKey).(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	u, err := service.GetUserProfile(r.Context(), email)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(u)
}

func UpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := r.Context().Value(middleware.UserEmailKey).(string)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var u user.UserStudent
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	u.Email = email

	if err := service.UpdateProfile(r.Context(), &u); err != nil {
		http.Error(w, "Error updating profile", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Profile updated successfully"})
}

func GetAllUsersHandler(w http.ResponseWriter, r *http.Request) {
	users, err := service.GetAllUsersProfiles(r.Context())
	if err != nil {
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := authorizedUser(r, "user")
	if !ok {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	profile, err := service.GetUserProfile(r.Context(), email)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := authorizedUser(r, "user")
	if !ok {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	var u user.UserStudent
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	u.Email = email

	if err := service.UpdateProfile(r.Context(), &u); err != nil {
		http.Error(w, "Error updating profile", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Profile updated successfully"})
}

func DeleteProfileHandler(w http.ResponseWriter, r *http.Request) {
	email, ok := authorizedUser(r, "user")
	if !ok {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := service.DeleteProfile(r.Context(), email); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	service.ClearSession(w)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Profile deleted successfully"})
}

func authorizedUser(r *http.Request, param string) (string, bool) {
	authEmail, ok := r.Context().Value(middleware.UserEmailKey).(string)
	if !ok {
		return "", false
	}

	requested := chi.URLParam(r, param)
	if requested == "" || requested == "me" {
		return authEmail, true
	}

	return authEmail, requested == authEmail
}
