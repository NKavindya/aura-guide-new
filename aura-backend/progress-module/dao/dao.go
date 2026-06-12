package dao

import (
	"context"
	"errors"
	"strings"
	"time"

	"aura-backend/common/db"
	"aura-backend/common/skillsmetrics"
	progress "aura-backend/progress-module"
	taskdao "aura-backend/task-plan-module/dao"
	"github.com/jackc/pgx/v5"
)

func GetOverview(ctx context.Context, email string) (*progress.Overview, error) {
	tasks, err := taskdao.GetTaskPlan(ctx, email)
	if err != nil {
		return nil, err
	}

	overview := &progress.Overview{TotalTasks: len(tasks)}
	for _, task := range tasks {
		if strings.EqualFold(task.Status, "completed") {
			overview.CompletedTasks++
		} else {
			overview.PendingTasks++
		}
	}
	return overview, nil
}

func GetCurrentTask(ctx context.Context, email string) (*progress.Task, error) {
	tasks, err := taskdao.GetTaskPlan(ctx, email)
	if err != nil {
		return nil, err
	}

	for _, task := range tasks {
		if !strings.EqualFold(task.Status, "completed") {
			return &progress.Task{
				ID:            task.ID,
				Task:          task.Task,
				Status:        task.Status,
				StartDateTime: task.StartDateTime,
				EndDateTime:   task.EndDateTime,
			}, nil
		}
	}
	return &progress.Task{}, nil
}

func GetCompletedTasks(ctx context.Context, email string) ([]progress.Task, error) {
	tasks, err := taskdao.GetTaskPlan(ctx, email)
	if err != nil {
		return nil, err
	}

	result := make([]progress.Task, 0)
	for _, task := range tasks {
		if strings.EqualFold(task.Status, "completed") {
			result = append(result, progress.Task{
				ID:            task.ID,
				Task:          task.Task,
				Status:        task.Status,
				StartDateTime: task.StartDateTime,
				EndDateTime:   task.EndDateTime,
			})
		}
	}
	return result, nil
}

func GetDashboardSummary(ctx context.Context, email string) (*progress.DashboardSummary, error) {
	var summary progress.DashboardSummary
	var userID int

	err := db.Pool.QueryRow(ctx, `SELECT u.id, COALESCE(u.first_name, ''), COALESCE(u.last_name, ''), COALESCE(g.name, '')
		FROM user_student u
		LEFT JOIN goals g ON g.id = u.goal_id
		WHERE u.email = $1`, email).Scan(&userID, &summary.FirstName, &summary.LastName, &summary.CareerTitle)
	if err != nil {
		return nil, err
	}

	am, err := skillsmetrics.ForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	summary.CurrentScore = am.Percent
	summary.SkillAverage = am.Average
	summary.SkillReadinessLabel = am.ReadinessLabel

	dayStreak, err := RecordDailyCheckIn(ctx, userID)
	if err != nil {
		return nil, err
	}
	summary.DayStreak = dayStreak

	tasks, err := taskdao.GetTaskPlan(ctx, email)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	completedCnt, err := taskdao.CountCompletedTasks(ctx, userID)
	if err != nil {
		return nil, err
	}
	summary.CompletedTasks = completedCnt

	for _, task := range tasks {
		if strings.EqualFold(task.Status, "completed") {
			continue
		}

		taskItem := progress.Task{
			ID:            task.ID,
			Task:          task.Task,
			Status:        task.Status,
			StartDateTime: task.StartDateTime,
			EndDateTime:   task.EndDateTime,
		}

		summary.OngoingTasks = append(summary.OngoingTasks, taskItem)

		if task.StartDateTime != nil {
			taskStart := task.StartDateTime.In(now.Location())
			taskDay := time.Date(taskStart.Year(), taskStart.Month(), taskStart.Day(), 0, 0, 0, 0, now.Location())
			// Due today or overdue (aligned with Tasks "Today" tab)
			if !taskDay.After(todayStart) {
				summary.TodaysPlan = append(summary.TodaysPlan, taskItem)
			}
		}
	}

	return &summary, nil
}

func calendarDayUTC(t time.Time) time.Time {
	u := t.UTC()
	return time.Date(u.Year(), u.Month(), u.Day(), 0, 0, 0, 0, time.UTC)
}

func UserIDForEmail(ctx context.Context, email string) (int, error) {
	var userID int
	err := db.Pool.QueryRow(ctx, `SELECT id FROM user_student WHERE email = $1`, email).Scan(&userID)
	return userID, err
}

// GetDayStreak returns the stored streak without mutating it.
func GetDayStreak(ctx context.Context, userID int) (int, error) {
	var numberOfDays int
	err := db.Pool.QueryRow(ctx, `SELECT COALESCE(number_of_days, 0) FROM user_streak WHERE user_id = $1`, userID).Scan(&numberOfDays)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}
	return numberOfDays, nil
}

// RecordDailyCheckIn updates streak for today's login and returns the current count.
func RecordDailyCheckIn(ctx context.Context, userID int) (int, error) {
	now := time.Now().UTC()
	today := calendarDayUTC(now)
	yesterday := today.AddDate(0, 0, -1)

	var streakID int
	var numberOfDays int
	var lastUpdated time.Time
	err := db.Pool.QueryRow(ctx, `SELECT id, number_of_days, last_updated FROM user_streak WHERE user_id = $1`, userID).Scan(&streakID, &numberOfDays, &lastUpdated)
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, err
		}
		err = db.Pool.QueryRow(ctx, `INSERT INTO user_streak (user_id, number_of_days, last_updated) VALUES ($1, 1, $2) RETURNING number_of_days`, userID, now).Scan(&numberOfDays)
		if err != nil {
			return 0, err
		}
		return numberOfDays, nil
	}

	lastDay := calendarDayUTC(lastUpdated)
	switch {
	case lastDay.Equal(today):
		return numberOfDays, nil
	case lastDay.Equal(yesterday):
		numberOfDays++
	default:
		numberOfDays = 1
	}

	if _, err := db.Pool.Exec(ctx, `UPDATE user_streak SET number_of_days = $1, last_updated = $2 WHERE id = $3`, numberOfDays, now, streakID); err != nil {
		return 0, err
	}
	return numberOfDays, nil
}

type UpcomingTask struct {
	Task          string
	EndDateTime   time.Time
}

func GetUpcomingTaskDeadlines(ctx context.Context, email string, within time.Duration) ([]UpcomingTask, error) {
	tasks, err := taskdao.GetTaskPlan(ctx, email)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	limit := now.Add(within)
	out := make([]UpcomingTask, 0)
	for _, task := range tasks {
		if strings.EqualFold(task.Status, "completed") || task.EndDateTime == nil {
			continue
		}
		end := task.EndDateTime.UTC()
		if !end.Before(now) && !end.After(limit) {
			out = append(out, UpcomingTask{Task: task.Task, EndDateTime: end})
		}
	}
	return out, nil
}

func upsertAndGetDayStreak(ctx context.Context, userID int) (int, error) {
	return RecordDailyCheckIn(ctx, userID)
}
