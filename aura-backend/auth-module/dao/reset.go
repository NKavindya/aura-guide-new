package dao

import (
	"context"
	"time"

	"aura-backend/common/db"
)

func CreatePasswordResetToken(ctx context.Context, userID int, tokenHash string, expiresAt time.Time) error {
	_, _ = db.Pool.Exec(ctx, `DELETE FROM password_reset_token WHERE user_id = $1`, userID)
	_, err := db.Pool.Exec(ctx, `
INSERT INTO password_reset_token (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)`, userID, tokenHash, expiresAt)
	return err
}

func FindValidResetToken(ctx context.Context, tokenHash string) (userID int, err error) {
	err = db.Pool.QueryRow(ctx, `
SELECT user_id FROM password_reset_token
WHERE token_hash = $1 AND expires_at > NOW()`, tokenHash).Scan(&userID)
	return userID, err
}

func DeleteResetTokensForUser(ctx context.Context, userID int) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM password_reset_token WHERE user_id = $1`, userID)
	return err
}

func UpdatePasswordHash(ctx context.Context, userID int, passwordHash string) error {
	_, err := db.Pool.Exec(ctx, `UPDATE user_student SET password_hash = $1 WHERE id = $2`, passwordHash, userID)
	return err
}
