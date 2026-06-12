package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	auraLifeCoachApi "aura-backend/aura-life-coach-module/api"
	authApi "aura-backend/auth-module/api"
	badgeApi "aura-backend/badge-module/api"
	calendarApi "aura-backend/calendar-module/api"
	"aura-backend/common/db"
	"aura-backend/common/middleware"
	ethicsApi "aura-backend/ethical-validator-module/api"
	goalApi "aura-backend/goal-module/api"
	notificationApi "aura-backend/notification-module/api"
	onboardingApi "aura-backend/onboarding-module/api"
	progressApi "aura-backend/progress-module/api"
	settingsApi "aura-backend/settings-module/api"
	skillGapApi "aura-backend/skill-gap-analysis-module/api"
	skillApi "aura-backend/skill-module/api"
	taskPlanApi "aura-backend/task-plan-module/api"
	userApi "aura-backend/user-module/api"

	"github.com/go-chi/chi/v5"
	mid "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	if err := db.InitDB(); err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}
	defer db.CloseDB()

	r := chi.NewRouter()

	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	originSet := map[string]bool{}
	for _, origin := range strings.Split(allowedOrigins, ",") {
		o := strings.TrimSpace(origin)
		if o != "" {
			originSet[o] = true
		}
	}

	// Safe local defaults for web/mobile dev if ALLOWED_ORIGINS is unset.
	if len(originSet) == 0 {
		originSet["http://localhost:8081"] = true
		originSet["http://localhost:8082"] = true
		originSet["http://127.0.0.1:8081"] = true
		originSet["http://127.0.0.1:8082"] = true
	}

	c := cors.New(cors.Options{
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		AllowOriginFunc: func(origin string) bool {
			if originSet[origin] {
				return true
			}
			// Allow any localhost/127.0.0.1 port in dev.
			return strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:")
		},
		AllowCredentials: true,
		MaxAge:           300,
	})
	r.Use(c.Handler)

	r.Use(mid.Logger)
	r.Use(mid.Recoverer)

	r.Post("/signup", authApi.SignupHandler)
	r.Post("/auth/validate-email", authApi.ValidateEmailHandler)
	r.Post("/login", authApi.LoginHandler)
	r.Post("/auth/signup", authApi.SignupHandler)
	r.Post("/auth/signin", authApi.SigninHandler)
	r.Post("/auth/signout", authApi.SignoutHandler)

	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware)

		r.Get("/user", userApi.GetUserHandler)
		r.Put("/user", userApi.UpdateUserHandler)
		r.Get("/users", userApi.GetAllUsersHandler)
		r.Get("/users/profile/{user}", userApi.GetProfileHandler)
		r.Put("/users/profile/{user}", userApi.UpdateProfileHandler)
		r.Delete("/users/profile/{user}", userApi.DeleteProfileHandler)

		r.Get("/skills", skillApi.GetSkillsHandler)
		r.Get("/skill/categories", skillApi.GetCategoriesHandler)
		r.Get("/goals", goalApi.GetGoalsHandler)
		r.Get("/goals/summary", goalApi.GetGoalSummaryHandler)

		r.Put("/onboarding/{userData}", onboardingApi.UpdateOnboardingHandler)

		r.Get("/aura-life-coach/ProfessionalCommunicationQuestions", auraLifeCoachApi.GetProfessionalCommunicationQuestionsHandler)
		r.Get("/aura-life-coach/BehavioralInterviewQuestions", auraLifeCoachApi.GetBehavioralInterviewQuestionsHandler)
		r.Get("/aura-life-coach/Reflection and Self AssessmentQuestions", auraLifeCoachApi.GetReflectionSelfAssessmentQuestionsHandler)
		r.Get("/aura-life-coach/CodeUnderstandingQuestions", auraLifeCoachApi.GetCodeUnderstandingQuestionsHandler)
		r.Get("/aura-life-coach/DebuggingReasoningQuestions", auraLifeCoachApi.GetDebuggingReasoningQuestionsHandler)
		r.Get("/aura-life-coach/AlgorithmicThinkingQuestions", auraLifeCoachApi.GetAlgorithmicThinkingQuestionsHandler)
		r.Get("/aura-life-coach/GitConceptKnowledgeQuestions", auraLifeCoachApi.GetGitConceptKnowledgeQuestionsHandler)
		r.Get("/aura-life-coach/BehavioralInterviewFeedback", auraLifeCoachApi.GetBehavioralInterviewFeedbackHandler)
		r.Post("/aura-life-coach/cv/upload", auraLifeCoachApi.UploadCVHandler)
		r.Post("/aura-life-coach/cv/upload-pdf", auraLifeCoachApi.UploadCVPDFHandler)
		r.Post("/aura-life-coach/cv/analyze", auraLifeCoachApi.AnalyzeCVHandler)
		r.Get("/aura-life-coach/cv/feedback", auraLifeCoachApi.GetCVFeedbackHandler)
		r.Get("/aura-life-coach/cv/list", auraLifeCoachApi.ListCVsHandler)
		r.Get("/aura-life-coach/cv/download", auraLifeCoachApi.DownloadCVHandler)

		r.Post("/aura-ethical-validator/answer", ethicsApi.ValidateAnswerHandler)
		r.Get("/aura-ethical-validator/answer/status", ethicsApi.GetValidationStatusHandler)

		r.Get("/user/careerPath", taskPlanApi.GetCareerPathHandler)
		r.Get("/user/skilScore", taskPlanApi.GetSkillScoreHandler)
		r.Get("/task-plan/generatePlan", taskPlanApi.GeneratePlanHandler)
		r.Get("/task-plan/taskPlan", taskPlanApi.GetTaskPlanHandler)
		r.Put("/task-plan/{taskId}", taskPlanApi.UpdateTaskPlanHandler)
		r.Get("/task-plan/task/{today}", taskPlanApi.GetTasksForDateHandler)
		r.Post("/task-plan/tasks", taskPlanApi.AddTaskHandler)
		r.Put("/task-plan/tasks/{taskId}/complete", taskPlanApi.CompleteTaskHandler)
		r.Put("/task-plan/tasks/{taskId}", taskPlanApi.UpdateTaskHandler)
		r.Delete("/task-plan/tasks/{taskId}", taskPlanApi.DeleteTaskHandler)
		r.Delete("/task-plan/agent-tasks/{taskId}", taskPlanApi.DeleteAgentTaskHandler)

		r.Get("/progress/overview", progressApi.GetOverviewHandler)
		r.Get("/progress/currentTask", progressApi.GetCurrentTaskHandler)
		r.Get("/progress/CompletedTasks", progressApi.GetCompletedTasksHandler)
		r.Get("/progress/dashboard", progressApi.GetDashboardSummaryHandler)
		r.Post("/progress/check-in", progressApi.RecordCheckInHandler)

		r.Get("/badges/earned", badgeApi.GetEarnedBadgesHandler)

		r.Get("/calendar/events", calendarApi.GetEventsHandler)
		r.Post("/calendar/add-event", calendarApi.AddEventHandler)

		r.Get("/skillScore/skillLevel", skillGapApi.GetSkillLevelsHandler)
		r.Get("/skill-gap-analysis/skillGap", skillGapApi.GetSkillGapHandler)

		r.Get("/notification/dailyTaskReminder", notificationApi.GetDailyTaskReminderHandler)
		r.Get("/notification/motivationalQuote", notificationApi.GetMotivationalQuoteHandler)
		r.Get("/notification/list", notificationApi.ListNotificationsHandler)
		r.Post("/notification/mark-all-read", notificationApi.MarkAllReadHandler)

		r.Post("/settings/preferences", settingsApi.UpdatePreferencesHandler)
		r.Post("/settings/notificationPreferences", settingsApi.UpdateNotificationPreferencesHandler)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("AURA Backend starting on port %s...\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
