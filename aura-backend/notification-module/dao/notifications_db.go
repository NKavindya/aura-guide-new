package dao

import (
	"context"
	"fmt"
	"strings"
	"time"

	"aura-backend/common/db"
	notification "aura-backend/notification-module"
	progressdao "aura-backend/progress-module/dao"
)

func ListForUser(ctx context.Context, userID int) ([]notification.Item, error) {
	rows, err := db.Pool.Query(ctx, `
SELECT id, COALESCE(title, ''), COALESCE(message, ''), COALESCE(notification_type, 'reminder'),
       COALESCE(is_read, false), COALESCE(send_date_time, NOW())
FROM user_notification
WHERE user_id = $1
ORDER BY send_date_time DESC, id DESC
LIMIT 50`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]notification.Item, 0)
	for rows.Next() {
		var item notification.Item
		if err := rows.Scan(&item.ID, &item.Title, &item.Message, &item.Type, &item.Read, &item.SentAt); err != nil {
			return nil, err
		}
		item.Time = formatRelativeTime(item.SentAt)
		if item.Title == "" {
			item.Title = defaultTitle(item.Type)
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func MarkAllRead(ctx context.Context, userID int) error {
	_, err := db.Pool.Exec(ctx, `UPDATE user_notification SET is_read = true WHERE user_id = $1`, userID)
	return err
}

func insertIfNewToday(ctx context.Context, userID int, nType, title, message string) error {
	var exists bool
	err := db.Pool.QueryRow(ctx, `
SELECT EXISTS(
  SELECT 1 FROM user_notification
  WHERE user_id = $1 AND COALESCE(title, '') = $2
    AND send_date_time >= CURRENT_DATE
)`, userID, title).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	_, err = db.Pool.Exec(ctx, `
INSERT INTO user_notification (user_id, title, message, notification_type, send_date_time, is_read)
VALUES ($1, $2, $3, $4, NOW(), false)`, userID, title, message, nType)
	return err
}

func SyncForUser(ctx context.Context, email string) error {
	var userID int
	if err := db.Pool.QueryRow(ctx, `SELECT id FROM user_student WHERE email = $1`, email).Scan(&userID); err != nil {
		return err
	}

	reminder, err := GetDailyTaskReminder(ctx, email)
	if err == nil && reminder != nil && strings.TrimSpace(reminder.Message) != "" {
		_ = insertIfNewToday(ctx, userID, "task", "Today's focus", reminder.Message)
	}

	quote := GetMotivationalQuote()
	if strings.TrimSpace(quote.Message) != "" {
		_ = insertIfNewToday(ctx, userID, "ai", "Coach insight", quote.Message)
	}

	streak, err := progressdao.GetDayStreak(ctx, userID)
	if err == nil {
		for _, milestone := range []int{3, 7, 14, 30, 60} {
			if streak >= milestone {
				title := fmt.Sprintf("%d-day streak", milestone)
				msg := fmt.Sprintf("Congratulations — you've logged in %d days in a row. Keep the momentum going!", milestone)
				_ = insertIfNewToday(ctx, userID, "achievement", title, msg)
			}
		}
	}

	tasks, err := progressdao.GetUpcomingTaskDeadlines(ctx, email, 48*time.Hour)
	if err == nil {
		for _, t := range tasks {
			title := "Task due soon"
			msg := fmt.Sprintf("%s is due by %s.", t.Task, t.EndDateTime.Format("Jan 2, 3:04 PM"))
			_ = insertIfNewToday(ctx, userID, "task", title, msg)
		}
	}

	return nil
}

func formatRelativeTime(t time.Time) string {
	now := time.Now()
	diff := now.Sub(t)
	switch {
	case diff < time.Minute:
		return "Just now"
	case diff < time.Hour:
		return fmt.Sprintf("%d min ago", int(diff.Minutes()))
	case diff < 24*time.Hour:
		return fmt.Sprintf("%d hours ago", int(diff.Hours()))
	case diff < 48*time.Hour:
		return "Yesterday"
	default:
		return t.Format("Jan 2")
	}
}

func defaultTitle(nType string) string {
	switch nType {
	case "achievement":
		return "Achievement"
	case "task":
		return "Task reminder"
	case "ai":
		return "AI Coach"
	default:
		return "Notification"
	}
}
