package service

import (
	"context"

	"aura-backend/common/db"
	notification "aura-backend/notification-module"
	"aura-backend/notification-module/dao"
)

func GetDailyTaskReminder(ctx context.Context, email string) (*notification.Response, error) {
	return dao.GetDailyTaskReminder(ctx, email)
}

func GetMotivationalQuote() notification.Response {
	return dao.GetMotivationalQuote()
}

func SyncAndList(ctx context.Context, email string) ([]notification.Item, error) {
	if err := dao.SyncForUser(ctx, email); err != nil {
		return nil, err
	}
	var userID int
	if err := db.Pool.QueryRow(ctx, `SELECT id FROM user_student WHERE email = $1`, email).Scan(&userID); err != nil {
		return nil, err
	}
	return dao.ListForUser(ctx, userID)
}

func MarkAllRead(ctx context.Context, email string) error {
	var userID int
	if err := db.Pool.QueryRow(ctx, `SELECT id FROM user_student WHERE email = $1`, email).Scan(&userID); err != nil {
		return err
	}
	return dao.MarkAllRead(ctx, userID)
}
