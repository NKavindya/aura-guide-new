package service

import (
	"context"

	progress "aura-backend/progress-module"
	"aura-backend/progress-module/dao"
)

func GetOverview(ctx context.Context, email string) (*progress.Overview, error) {
	return dao.GetOverview(ctx, email)
}

func GetCurrentTask(ctx context.Context, email string) (*progress.Task, error) {
	return dao.GetCurrentTask(ctx, email)
}

func GetCompletedTasks(ctx context.Context, email string) ([]progress.Task, error) {
	return dao.GetCompletedTasks(ctx, email)
}

func GetDashboardSummary(ctx context.Context, email string) (*progress.DashboardSummary, error) {
	return dao.GetDashboardSummary(ctx, email)
}

func RecordCheckIn(ctx context.Context, email string) (int, error) {
	userID, err := dao.UserIDForEmail(ctx, email)
	if err != nil {
		return 0, err
	}
	return dao.RecordDailyCheckIn(ctx, userID)
}
