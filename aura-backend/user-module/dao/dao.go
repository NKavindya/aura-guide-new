package dao

import (
	"context"
	"log"

	"aura-backend/common/cvstorage"
	"aura-backend/common/db"
	"aura-backend/user-module"
)

func GetUserByEmail(ctx context.Context, email string) (*user.UserStudent, error) {
	var u user.UserStudent
	query := `SELECT id, goal_id, email, first_name, last_name, degree_program, study_year, university, technical_skill_level, soft_skill_level, availability_type, availability_hours, current_score, recommendation
	          FROM user_student WHERE email = $1`

	err := db.Pool.QueryRow(ctx, query, email).Scan(
		&u.ID, &u.GoalID, &u.Email, &u.FirstName, &u.LastName,
		&u.DegreeProgram, &u.StudyYear, &u.University, &u.TechnicalSkill, &u.SoftSkill, &u.Availability, &u.AvailabilityH, &u.CurrentScore, &u.Recommendation,
	)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func UpdateUser(ctx context.Context, u *user.UserStudent) error {
	query := `UPDATE user_student SET
		first_name = $1,
		last_name = $2,
		degree_program = $3,
		study_year = $4,
		university = $5,
		technical_skill_level = $6,
		soft_skill_level = $7,
		availability_type = $8,
		availability_hours = $9,
		goal_id = $10,
		current_score = COALESCE($11, current_score),
		recommendation = COALESCE($12, recommendation)
		WHERE email = $13`

	_, err := db.Pool.Exec(ctx, query,
		u.FirstName, u.LastName, u.DegreeProgram, u.StudyYear, u.University,
		u.TechnicalSkill, u.SoftSkill, u.Availability, u.AvailabilityH,
		u.GoalID, u.CurrentScore, u.Recommendation, u.Email)
	return err
}

func GetAllUsers(ctx context.Context) ([]user.UserStudent, error) {
	query := `SELECT id, goal_id, email, first_name, last_name, degree_program, study_year, university, technical_skill_level, soft_skill_level, availability_type, availability_hours, current_score, recommendation
	          FROM user_student`
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		log.Printf("GetAllUsers Query error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var users []user.UserStudent
	for rows.Next() {
		var u user.UserStudent
		err := rows.Scan(
			&u.ID, &u.GoalID, &u.Email, &u.FirstName, &u.LastName,
			&u.DegreeProgram, &u.StudyYear, &u.University, &u.TechnicalSkill, &u.SoftSkill, &u.Availability, &u.AvailabilityH, &u.CurrentScore, &u.Recommendation,
		)
		if err != nil {
			log.Printf("GetAllUsers Scan error: %v", err)
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func DeleteUserByEmail(ctx context.Context, email string) error {
	u, err := GetUserByEmail(ctx, email)
	if err != nil {
		return err
	}
	uid := u.ID
	var cvPath *string
	_ = db.Pool.QueryRow(ctx, `SELECT file_path FROM user_cv_analysis WHERE user_id = $1`, uid).Scan(&cvPath)
	stmts := []string{
		`DELETE FROM chat_message WHERE session_id IN (SELECT id FROM chat_sessions WHERE user_id = $1)`,
		`DELETE FROM chat_sessions WHERE user_id = $1`,
		`DELETE FROM user_skills WHERE user_id = $1`,
		`DELETE FROM user_common_tasks WHERE user_id = $1`,
		`DELETE FROM user_custom_tasks WHERE user_id = $1`,
		`DELETE FROM user_notification WHERE user_id = $1`,
		`DELETE FROM user_badge WHERE user_id = $1`,
		`DELETE FROM user_cv_analysis WHERE user_id = $1`,
		`DELETE FROM user_streak WHERE user_id = $1`,
		`DELETE FROM password_reset_token WHERE user_id = $1`,
		`DELETE FROM user_student WHERE id = $1`,
	}
	for _, q := range stmts {
		if _, err := db.Pool.Exec(ctx, q, uid); err != nil {
			log.Printf("DeleteUserByEmail step failed (%s): %v", q, err)
			return err
		}
	}
	_, _ = db.Pool.Exec(ctx, `DELETE FROM user_cv WHERE user_id = $1`, uid)
	if cvPath != nil && *cvPath != "" {
		cvstorage.RemoveFile(*cvPath)
	}
	return nil
}
