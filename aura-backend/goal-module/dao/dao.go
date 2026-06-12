package dao

import (
	"context"
	"log"
	"math"
	"strings"

	"aura-backend/common/db"
	"aura-backend/common/skillsmetrics"
	"aura-backend/goal-module"
	taskdao "aura-backend/task-plan-module/dao"
)

func GetAllGoals(ctx context.Context) ([]goal.Goal, error) {
	query := `SELECT id, name FROM goals`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("GetAllGoals Query error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var goals []goal.Goal
	for rows.Next() {
		var g goal.Goal
		err := rows.Scan(&g.ID, &g.Name)
		if err != nil {
			log.Printf("GetAllGoals Scan error: %v", err)
			return nil, err
		}
		goals = append(goals, g)
	}
	return goals, nil
}

func GetGoalSummaryByEmail(ctx context.Context, email string) (*goal.GoalSummaryResponse, error) {
	result := &goal.GoalSummaryResponse{}
	var userID int
	var goalID *int
	if err := db.Pool.QueryRow(ctx, `SELECT u.id, u.goal_id, COALESCE(g.name, '')
		FROM user_student u LEFT JOIN goals g ON g.id = u.goal_id WHERE u.email = $1`, email).Scan(&userID, &goalID, &result.CareerTitle); err != nil {
		return nil, err
	}

	cnt, err := taskdao.CountCompletedTasks(ctx, userID)
	if err != nil {
		return nil, err
	}
	result.CompletedTasks = cnt

	am, err := skillsmetrics.ForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	result.AuraScorePercent = am.Percent
	result.SkillAverage = am.Average
	result.SkillReadinessLabel = am.ReadinessLabel

	rec, err := UpdateCareerRecommendationIfReady(ctx, userID, goalID, result.CareerTitle, am.ReadinessLabel, am.Average)
	if err != nil {
		log.Printf("career recommendation: %v", err)
	} else if rec != "" {
		result.Recommendation = rec
	} else {
		var stored string
		if err := db.Pool.QueryRow(ctx, `SELECT COALESCE(recommendation, '') FROM user_student WHERE id = $1`, userID).Scan(&stored); err == nil && strings.TrimSpace(stored) != "" {
			result.Recommendation = stored
		}
	}

	if goalID == nil {
		return result, nil
	}

	rows, err := db.Pool.Query(ctx, `SELECT DISTINCT ON (s.id)
		s.id, s.name, COALESCE(c.name, ''), gsm.score_id,
		COALESCE(us.avg_score, 0),
		COALESCE(req.level, '')
		FROM goal_skill_matrix gsm
		JOIN skills s ON s.id = gsm.skill_id
		LEFT JOIN category c ON c.id = s.category_id
		LEFT JOIN LATERAL (
			SELECT AVG(us2.score_id::double precision) AS avg_score
			FROM user_skills us2
			WHERE us2.user_id = $1 AND us2.skill_id = s.id
		) us ON true
		LEFT JOIN skill_matrix_levels req ON req.score_id = gsm.score_id
		WHERE gsm.goal_id = $2
		ORDER BY s.id, gsm.id`, userID, *goalID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		item := goal.GoalSkillProgress{}
		var avgScore float64
		if err := rows.Scan(
			&item.SkillID,
			&item.SkillName,
			&item.CategoryName,
			&item.RequiredScore,
			&avgScore,
			&item.RequiredLevel,
		); err != nil {
			return nil, err
		}
		if avgScore <= 0 {
			item.CurrentScore = 0
			item.CurrentPct = 0
			item.CurrentLevel = "Not assessed"
		} else {
			avgScore = math.Round(avgScore*100) / 100
			item.CurrentScore = int(math.Round(avgScore))
			item.CurrentPct = avgScoreToPercent(avgScore)
			item.CurrentLevel = avgScoreToLevel(avgScore)
		}
		if item.RequiredLevel == "" {
			item.RequiredLevel = scoreIDToLevel(item.RequiredScore)
		} else {
			item.RequiredLevel = normalizeLevelLabel(item.RequiredLevel)
		}
		item.RequiredPct = scoreToPercent(item.RequiredScore)
		result.Skills = append(result.Skills, item)
	}
	return result, rows.Err()
}

func scoreToPercent(score int) int {
	switch score {
	case 1:
		return 33
	case 2:
		return 67
	case 3:
		return 100
	default:
		return 0
	}
}

func avgScoreToPercent(avg float64) int {
	if avg <= 0 {
		return 0
	}
	pct := int(math.Round(avg / 3.0 * 100))
	if pct > 100 {
		return 100
	}
	return pct
}

func avgScoreToLevel(avg float64) string {
	if avg < 1.65 {
		return "Beginner"
	}
	if avg < 2.5 {
		return "Developing"
	}
	return "Industry Ready"
}

func scoreIDToLevel(score int) string {
	switch score {
	case 1:
		return "Beginner"
	case 2:
		return "Developing"
	case 3:
		return "Industry Ready"
	default:
		return "—"
	}
}

func normalizeLevelLabel(level string) string {
	l := strings.ToLower(strings.TrimSpace(level))
	switch {
	case strings.Contains(l, "strong") || strings.Contains(l, "industry"):
		return "Industry Ready"
	case strings.Contains(l, "moderate") || strings.Contains(l, "develop"):
		return "Developing"
	case strings.Contains(l, "low") || strings.Contains(l, "begin"):
		return "Beginner"
	default:
		return level
	}
}
