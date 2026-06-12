package db

import (
	"context"
	"log"
)

// runMigrations applies idempotent schema fixes and deduplicates reference data.
func runMigrations(ctx context.Context) error {
	steps := []struct {
		name string
		fn   func(context.Context) error
	}{
		{"unique indexes", ensureUniqueIndexes},
		{"allow multiple skill attempts", allowMultipleSkillAttempts},
		{"dedupe reference tables", dedupeReferenceTables},
		{"seed statuses", seedAllStatuses},
		{"seed goal skill matrix", seedGoalSkillMatrix},
		{"purge legacy auto plan tasks", purgeLegacyAutoPlanTasks},
	}
	for _, s := range steps {
		if err := s.fn(ctx); err != nil {
			log.Printf("migration %s: %v", s.name, err)
		}
	}
	return nil
}

func ensureUniqueIndexes(ctx context.Context) error {
	_, err := Pool.Exec(ctx, `
CREATE UNIQUE INDEX IF NOT EXISTS status_name_unique ON status (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS category_name_unique ON category (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS goals_name_unique ON goals (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS skills_name_unique ON skills (lower(trim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS gsm_goal_skill_unique ON goal_skill_matrix (goal_id, skill_id);
ALTER TABLE user_cv_analysis ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE user_cv_analysis ADD COLUMN IF NOT EXISTS file_size BIGINT;
CREATE TABLE IF NOT EXISTS password_reset_token (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES user_student(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS password_reset_token_user_idx ON password_reset_token (user_id);
`)
	return err
}

// allowMultipleSkillAttempts removes the one-row-per-skill constraint so each evaluation is stored.
func allowMultipleSkillAttempts(ctx context.Context) error {
	_, err := Pool.Exec(ctx, `DROP INDEX IF EXISTS user_skills_user_skill_unique`)
	return err
}

func dedupeReferenceTables(ctx context.Context) error {
	queries := []string{
		`DELETE FROM status a USING status b WHERE a.id > b.id AND lower(trim(a.name)) = lower(trim(b.name))`,
		`DELETE FROM category a USING category b WHERE a.id > b.id AND lower(trim(a.name)) = lower(trim(b.name))`,
		`DELETE FROM goals a USING goals b WHERE a.id > b.id AND lower(trim(a.name)) = lower(trim(b.name))`,
		`DELETE FROM skills a USING skills b WHERE a.id > b.id AND lower(trim(a.name)) = lower(trim(b.name))`,
		`DELETE FROM goal_skill_matrix a USING goal_skill_matrix b
		 WHERE a.id > b.id AND a.goal_id = b.goal_id AND a.skill_id = b.skill_id`,
	}
	for _, q := range queries {
		if _, err := Pool.Exec(ctx, q); err != nil {
			return err
		}
	}
	return nil
}

func dedupeUserSkills(ctx context.Context) error {
	_, err := Pool.Exec(ctx, `
DELETE FROM user_skills us
WHERE us.id NOT IN (
  SELECT MIN(id) FROM user_skills GROUP BY user_id, skill_id
)`)
	return err
}

func seedAllStatuses(ctx context.Context) error {
	for _, name := range []string{"pending", "in_progress", "completed", "abandoned"} {
		if err := ensureSingleRowCount(ctx, "status", name); err != nil {
			return err
		}
	}
	return nil
}

// Role-specific required scores (score_id 1–3) per career track.
var goalSkillRequirements = map[string]map[string]int{
	"Software Engineer": {
		"Professional Communication":       2,
		"Behavioral Interview Skills":      2,
		"Reflection and Self Assessment":   2,
		"Code Understanding":               3,
		"Debugging Reasoning":              3,
		"Algorithmic Thinking":             3,
		"Git Concept Knowledge":            2,
	},
	"Backend Developer": {
		"Professional Communication":       2,
		"Behavioral Interview Skills":      2,
		"Reflection and Self Assessment":   2,
		"Code Understanding":               3,
		"Debugging Reasoning":              3,
		"Algorithmic Thinking":             3,
		"Git Concept Knowledge":            3,
	},
	"QA Engineer": {
		"Professional Communication":       3,
		"Behavioral Interview Skills":      2,
		"Reflection and Self Assessment":   2,
		"Code Understanding":               2,
		"Debugging Reasoning":              3,
		"Algorithmic Thinking":             2,
		"Git Concept Knowledge":            2,
	},
	"DevOps Engineer": {
		"Professional Communication":       3,
		"Behavioral Interview Skills":      2,
		"Reflection and Self Assessment":   2,
		"Code Understanding":               2,
		"Debugging Reasoning":              3,
		"Algorithmic Thinking":             1,
		"Git Concept Knowledge":            3,
	},
}

func seedGoalSkillMatrix(ctx context.Context) error {
	for goalName, skills := range goalSkillRequirements {
		for skillName, scoreID := range skills {
			_, err := Pool.Exec(ctx, `
INSERT INTO goal_skill_matrix (goal_id, skill_id, score_id)
SELECT g.id, s.id, $3
FROM goals g
JOIN skills s ON lower(trim(s.name)) = lower(trim($2))
WHERE lower(trim(g.name)) = lower(trim($1))
ON CONFLICT DO NOTHING`, goalName, skillName, scoreID)
			if err != nil {
				// Fallback when ON CONFLICT target missing — upsert manually
				_, err2 := Pool.Exec(ctx, `
INSERT INTO goal_skill_matrix (goal_id, skill_id, score_id)
SELECT g.id, s.id, $3
FROM goals g
JOIN skills s ON lower(trim(s.name)) = lower(trim($2))
WHERE lower(trim(g.name)) = lower(trim($1))
AND NOT EXISTS (
  SELECT 1 FROM goal_skill_matrix gsm WHERE gsm.goal_id = g.id AND gsm.skill_id = s.id
)`, goalName, skillName, scoreID)
				if err2 != nil {
					return err2
				}
			}
			// Keep required score current for existing rows
			_, _ = Pool.Exec(ctx, `
UPDATE goal_skill_matrix gsm
SET score_id = $3
FROM goals g, skills s
WHERE gsm.goal_id = g.id AND gsm.skill_id = s.id
  AND lower(trim(g.name)) = lower(trim($1))
			AND lower(trim(s.name)) = lower(trim($2))`, goalName, skillName, scoreID)
		}
	}
	return nil
}

// purgeLegacyAutoPlanTasks removes old static plan rows seeded by generatePlan (skill_id set on user_custom_tasks).
// Personal tasks keep skill_id NULL; agent tasks live in user_common_tasks.
func purgeLegacyAutoPlanTasks(ctx context.Context) error {
	_, err := Pool.Exec(ctx, `DELETE FROM user_custom_tasks WHERE skill_id IS NOT NULL`)
	return err
}
