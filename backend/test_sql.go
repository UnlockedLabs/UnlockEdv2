package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/lib/pq"
)

func main() {
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	query := \`
		SELECT 
			pce.enrollment_status,
			p.name AS program_name,
			p.id AS program_id,
			pc.name AS class_name,
			pc.status AS status,
			pc.start_dt AS start_date,
			pc.end_dt AS end_date,
			pc.id AS class_id,
			pce.updated_at,
			pce.created_at
		FROM program_class_enrollments AS pce
		INNER JOIN program_classes pc ON pc.id = pce.class_id
		INNER JOIN programs p ON p.id = pc.program_id
		WHERE pce.user_id = 2
		GROUP BY 
			pce.enrollment_status,
			p.name, p.id,
			pc.name, pc.status, pc.start_dt, pc.end_dt, pc.id, pce.updated_at, pce.change_reason, pce.created_at
		ORDER BY pce.created_at desc
		LIMIT 1
	\`

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("SQL Error: %v", err)
		return
	}
	defer rows.Close()

	fmt.Println("SQL query executed successfully!")
	for rows.Next() {
		var enrollment_status, program_name, class_name, status string
		var program_id, class_id int
		var start_date, end_date, updated_at, created_at sql.NullTime
		var change_reason sql.NullString
		
		err := rows.Scan(&enrollment_status, &program_name, &program_id, &class_name, &status, &start_date, &end_date, &class_id, &updated_at, &created_at, &change_reason)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		
		fmt.Printf("Program: %s, Class: %s, Status: %s\n", program_name, class_name, enrollment_status)
	}
}
