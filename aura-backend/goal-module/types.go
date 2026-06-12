package goal

type Goal struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type GoalSkillProgress struct {
	SkillID        int    `json:"skill_id"`
	SkillName      string `json:"skill_name"`
	CategoryName   string `json:"category_name"`
	RequiredScore  int    `json:"required_score"`
	CurrentScore   int    `json:"current_score"`
	RequiredLevel  string `json:"required_level"`
	CurrentLevel   string `json:"current_level"`
	RequiredPct    int    `json:"required_pct"`
	CurrentPct     int    `json:"current_pct"`
}

type GoalSummaryResponse struct {
	CompletedTasks       int                 `json:"completed_tasks"`
	CareerTitle          string              `json:"career_title"`
	Skills               []GoalSkillProgress `json:"skills"`
	AuraScorePercent     int                 `json:"aura_score_percent"`
	SkillAverage         float64             `json:"skill_average"`
	SkillReadinessLabel  string              `json:"skill_readiness_label"`
	Recommendation       string              `json:"recommendation,omitempty"`
}
