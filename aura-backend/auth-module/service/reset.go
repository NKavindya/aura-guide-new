package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/smtp"
	"os"
	"strings"
	"time"

	authdao "aura-backend/auth-module/dao"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrResetEmailNotConfigured = errors.New("password reset email is not configured on the server")
	ErrInvalidResetToken       = errors.New("invalid or expired reset link")
)

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// RequestPasswordReset creates a reset token and emails it when SMTP is configured.
func RequestPasswordReset(ctx context.Context, email string) error {
	normalized := strings.TrimSpace(strings.ToLower(email))
	if !isValidEmail(normalized) {
		return ErrInvalidEmail
	}

	user, err := authdao.GetUserByEmail(ctx, normalized)
	if err != nil {
		// Do not reveal whether the account exists.
		return nil
	}

	token, err := generateToken()
	if err != nil {
		return err
	}
	expires := time.Now().UTC().Add(1 * time.Hour)
	if err := authdao.CreatePasswordResetToken(ctx, user.ID, hashToken(token), expires); err != nil {
		return err
	}

	if err := sendResetEmail(normalized, token); err != nil {
		return err
	}
	return nil
}

func sendResetEmail(to, token string) error {
	host := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	from := strings.TrimSpace(os.Getenv("SMTP_FROM"))
	appURL := strings.TrimSpace(os.Getenv("APP_URL"))
	if appURL == "" {
		appURL = "http://localhost:8081"
	}
	if host == "" || from == "" {
		return ErrResetEmailNotConfigured
	}

	port := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")

	link := fmt.Sprintf("%s/reset-password?token=%s&email=%s", strings.TrimRight(appURL, "/"), token, to)
	body := fmt.Sprintf("Hello,\n\nUse this link to reset your AURA Guide password (valid for 1 hour):\n\n%s\n\nIf you did not request this, ignore this email.\n", link)
	msg := []byte(fmt.Sprintf("To: %s\r\nSubject: AURA Guide password reset\r\n\r\n%s", to, body))
	addr := host + ":" + port

	if user != "" && pass != "" {
		auth := smtp.PlainAuth("", user, pass, host)
		return smtp.SendMail(addr, auth, from, []string{to}, msg)
	}
	return smtp.SendMail(addr, nil, from, []string{to}, msg)
}

// CompletePasswordReset validates token and sets a new password.
func CompletePasswordReset(ctx context.Context, email, token, newPassword string) error {
	if len(strings.TrimSpace(newPassword)) < 6 {
		return errors.New("password must be at least 6 characters")
	}
	normalized := strings.TrimSpace(strings.ToLower(email))
	user, err := authdao.GetUserByEmail(ctx, normalized)
	if err != nil {
		return ErrInvalidResetToken
	}
	uid, err := authdao.FindValidResetToken(ctx, hashToken(strings.TrimSpace(token)))
	if err != nil || uid != user.ID {
		return ErrInvalidResetToken
	}
	hashed, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := authdao.UpdatePasswordHash(ctx, user.ID, string(hashed)); err != nil {
		return err
	}
	return authdao.DeleteResetTokensForUser(ctx, user.ID)
}

// ResetEmailConfigured reports whether SMTP env vars are set.
func ResetEmailConfigured() bool {
	return strings.TrimSpace(os.Getenv("SMTP_HOST")) != "" && strings.TrimSpace(os.Getenv("SMTP_FROM")) != ""
}
