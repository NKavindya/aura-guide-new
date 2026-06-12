package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"aura-backend/auth-module/service"
)

type AuthRequest struct {
	Email               string `json:"email"`
	Password            string `json:"password"`
	FirstName           string `json:"first_name"`
	LastName            string `json:"last_name"`
	FirstNameCamel      string `json:"firstName"`
	LastNameCamel       string `json:"lastName"`
	DegreeProgram       string `json:"degree_program"`
	University          string `json:"university"`
	TechnicalSkillLevel string `json:"technical_skill_level"`
	SoftSkillLevel      string `json:"soft_skill_level"`
	AvailabilityType    string `json:"availability_type"`
	AvailabilityHours   int    `json:"availability_hours"`
	GoalID              int    `json:"goal_id"`
	StudyYear           int    `json:"study_year"`
}

func RegisterHandlers(mux http.Handler) {
}

func SignupHandler(w http.ResponseWriter, r *http.Request) {
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if req.FirstName == "" {
		req.FirstName = req.FirstNameCamel
	}
	if req.LastName == "" {
		req.LastName = req.LastNameCamel
	}

	if err := service.Signup(
		r.Context(),
		req.Email,
		req.Password,
		req.FirstName,
		req.LastName,
		req.DegreeProgram,
		req.University,
		req.TechnicalSkillLevel,
		req.SoftSkillLevel,
		req.AvailabilityType,
		req.AvailabilityHours,
		req.GoalID,
		req.StudyYear,
	); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidEmail):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrEmailExists):
			http.Error(w, err.Error(), http.StatusConflict)
		default:
			http.Error(w, "Error creating user: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "User created successfully"})
}

func ValidateEmailHandler(w http.ResponseWriter, r *http.Request) {
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if err := service.ValidateEmailForSignup(r.Context(), req.Email); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidEmail):
			http.Error(w, err.Error(), http.StatusBadRequest)
		case errors.Is(err, service.ErrEmailExists):
			http.Error(w, err.Error(), http.StatusConflict)
		default:
			http.Error(w, "Error validating email: "+err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"valid": true})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	signin(w, r)
}

func SigninHandler(w http.ResponseWriter, r *http.Request) {
	signin(w, r)
}

func signin(w http.ResponseWriter, r *http.Request) {
	var req AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Email) == "" || req.Password == "" {
		http.Error(w, "email and password are required", http.StatusBadRequest)
		return
	}

	token, err := service.Login(r.Context(), req.Email, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    token,
		Expires:  time.Now().Add(24 * time.Hour),
		HttpOnly: true,
		Secure:   true,
		Path:     "/",
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token, "message": "Login successful"})
}

func SignoutHandler(w http.ResponseWriter, r *http.Request) {
	service.Signout(w)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logout successful"})
}

type ResetRequestBody struct {
	Email string `json:"email"`
}

type ResetConfirmBody struct {
	Email       string `json:"email"`
	Token       string `json:"token"`
	NewPassword string `json:"new_password"`
}

func RequestPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	var body ResetRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	err := service.RequestPasswordReset(r.Context(), body.Email)
	if err != nil {
		if errors.Is(err, service.ErrResetEmailNotConfigured) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error":   err.Error(),
				"message": "Email delivery is not configured. Set SMTP_HOST and SMTP_FROM on the server.",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "If an account exists for this email, reset instructions have been sent.",
	})
}

func ConfirmPasswordResetHandler(w http.ResponseWriter, r *http.Request) {
	var body ResetConfirmBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	if err := service.CompletePasswordReset(r.Context(), body.Email, body.Token, body.NewPassword); err != nil {
		code := http.StatusBadRequest
		if errors.Is(err, service.ErrInvalidResetToken) {
			code = http.StatusUnauthorized
		}
		http.Error(w, err.Error(), code)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password updated successfully"})
}
