package notification

import "time"

type Response struct {
	Message string    `json:"message"`
	Date    time.Time `json:"date"`
}

type Item struct {
	ID        int       `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Time      string    `json:"time"`
	Read      bool      `json:"read"`
	SentAt    time.Time `json:"-"`
}

type ListResponse struct {
	Notifications []Item `json:"notifications"`
}
