package dao

import (
	"context"
	"fmt"
	"strings"

	"aura-backend/common/db"
)

func isIndustryReady(label string, avg float64) bool {
	if avg >= 2.5 {
		return true
	}
	l := strings.ToLower(strings.TrimSpace(label))
	return strings.Contains(l, "industry")
}

type goalFit struct {
	ID    int
	Name  string
	Met   int
	Total int
}

func bestGoalFit(ctx context.Context, userID int) (*goalFit, error) {
	rows, err := db.Pool.Query(ctx, `
SELECT g.id, g.name,
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE COALESCE(us.avg_score, 0) >= gsm.score_id::float8)::int AS met
FROM goals g
JOIN goal_skill_matrix gsm ON gsm.goal_id = g.id
LEFT JOIN LATERAL (
  SELECT AVG(us2.score_id::double precision) AS avg_score
  FROM user_skills us2
  JOIN skills s ON s.id = us2.skill_id
  WHERE us2.user_id = $1 AND us2.skill_id = gsm.skill_id
) us ON true
GROUP BY g.id, g.name
ORDER BY met DESC, g.id ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var best *goalFit
	for rows.Next() {
		var f goalFit
		if err := rows.Scan(&f.ID, &f.Name, &f.Total, &f.Met); err != nil {
			return nil, err
		}
		if best == nil || f.Met > best.Met || (f.Met == best.Met && f.Total > best.Total) {
			copy := f
			best = &copy
		}
	}
	return best, rows.Err()
}

func UpdateCareerRecommendationIfReady(ctx context.Context, userID int, currentGoalID *int, currentGoalName, readinessLabel string, skillAvg float64) (string, error) {
	if !isIndustryReady(readinessLabel, skillAvg) {
		return "", nil
	}

	current := strings.TrimSpace(currentGoalName)
	if current == "" && currentGoalID != nil {
		_ = db.Pool.QueryRow(ctx, `SELECT name FROM goals WHERE id = $1`, *currentGoalID).Scan(&current)
	}
	if current == "" {
		current = "your selected track"
	}

	fit, err := bestGoalFit(ctx, userID)
	if err != nil {
		return "", err
	}
	if fit == nil {
		return "", nil
	}

	var text string
	if strings.EqualFold(strings.TrimSpace(fit.Name), strings.TrimSpace(current)) {
		text = fmt.Sprintf(
			"You are industry ready on %s. Your skill profile strongly matches this track — keep completing tasks to stay sharp.",
			current,
		)
	} else {
		text = fmt.Sprintf(
			"You are industry ready on %s. Based on your assessed skills (%d/%d requirements met on %s), %s may also be a strong fit. Review your Career Track for details.",
			current, fit.Met, fit.Total, fit.Name, fit.Name,
		)
	}

	_, err = db.Pool.Exec(ctx, `UPDATE user_student SET recommendation = $1 WHERE id = $2`, text, userID)
	if err != nil {
		return "", err
	}
	return text, nil
}
