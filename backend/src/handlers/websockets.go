package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerWebsocketRoute() {
	srv.Mux.Handle("/api/ws/listen", srv.authMiddleware(srv.handleError(srv.handleWebsocketConnection)))
	//going to need a second listener here for subsssss....hmmmm...
}

const (
	bytesBuffer = 256
)

type ActivityEvent struct {
	EventType             string `json:"event_type"` // "page_visit", "disconnect"
	OpenContentActivityID int64  `json:"activity_id"`
	Page                  string `json:"page"` //not sure if I even need this or not
	Timestamp             int64  `json:"timestamp"`
	UserID                int64  `json:"user_id"`
}

type WsClient struct {
	Conn     *websocket.Conn
	UserID   uint
	ctx      context.Context
	cancel   context.CancelFunc
	sendChan chan []byte
	// connected  time.Time
	// activePage string
}

type ClientManager struct {
	clients map[uint]*WsClient
	mutex   sync.RWMutex
}

func newClientManager() *ClientManager {
	return &ClientManager{
		clients: make(map[uint]*WsClient),
		mutex:   sync.RWMutex{},
	}
}

func (cm *ClientManager) addClient(userId uint, client *WsClient) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	if cm.clients[userId] == nil {
		cm.clients[userId] = client
		log.Infof("Added client with user_id %d", userId)
	} else {
		log.Warnf("Client already existed with user_id %d", userId)
	}
}

func (cm *ClientManager) removeClient(userId uint, client *WsClient, reason string) {
	client.cancel()
	err := client.Conn.Close(websocket.StatusNormalClosure, reason)
	if err != nil {
		log.Errorf("Failed to close connection: %v", err)
	}
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	if cm.clients[userId] != nil {
		log.Infof("Removing client user_id %d", client.UserID)
		delete(cm.clients, userId)
	}
}

func (cm *ClientManager) notifyUser(userId uint, event ActivityEvent) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	if client, ok := cm.clients[userId]; ok {
		client.send(event)
	}
}

// func (cm *ClientManager) notifyUser(userId uint, message []byte) {
// 	cm.mutex.RLock()
// 	defer cm.mutex.RUnlock()
// 	if client, ok := cm.clients[userId]; ok {
// 		client.send(message)
// 	}
// }

func (client *WsClient) send(event ActivityEvent) {
	log.Infof("Sending message to user_id %d, message: %d", client.UserID, event.OpenContentActivityID)

	response, err := json.Marshal(event)
	if err != nil {
		log.Errorf("Failed to marshal event: %v", err)
		return
	}
	client.sendChan <- response
}

// func (client *WsClient) send(message []byte) {
// 	log.Infof("Sending message to user_id %d, message: %s", client.UserID, message)

// 	client.sendChan <- message
// }

func (client *WsClient) writePump() {
	for {
		select {
		case message := <-client.sendChan:
			log.Infof("Writing message to user_id %d", client.UserID)
			err := client.Conn.Write(context.Background(), websocket.MessageText, message)
			if err != nil {
				log.Errorf("Failed to write message: %v", err)
				return
			}
		case <-client.ctx.Done():
			return
		}
	}
}

func (srv *Server) handleWebsocketConnection(w http.ResponseWriter, r *http.Request, log sLog) error {
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return newInternalServerServiceError(err, "")
	}
	log.info("WebSocket connection established")
	user := r.Context().Value(ClaimsKey).(*Claims)
	ctx, cancel := context.WithCancel(context.Background())
	client := &WsClient{
		Conn:     conn,
		UserID:   user.UserID,
		ctx:      ctx,
		cancel:   cancel,
		sendChan: make(chan []byte, bytesBuffer),
	}
	srv.wsClient.addClient(user.UserID, client)
	go client.writePump()
	go srv.handleWsHeartbeat(client)
	go srv.handleWsReader(ctx, client)
	<-ctx.Done()
	srv.wsClient.removeClient(user.UserID, client, "") //this removes client
	return nil
}

func (srv *Server) handleWsReader(ctx context.Context, client *WsClient) {
	defer client.cancel()
	for {
		_, msg, err := client.Conn.Read(ctx)
		if err != nil {
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
				websocket.CloseStatus(err) == websocket.StatusGoingAway {
				log.Info("WebSocket connection closed by client")
			} else {
				log.Errorf("Error reading from WebSocket: %v", err)
			}
			srv.wsClient.removeClient(client.UserID, client, "reading from client failed")
			return
		}
		//FIXME JUST TESTING THIS HERE!!!!!!!!
		fmt.Println(">>>>>>>>>>>>>>>>>>>>>>reading websocket message, here...going on to the next step....")

		// Parse JSON event
		var event ActivityEvent
		if err := json.Unmarshal(msg, &event); err != nil {
			fmt.Println("error unmarsahling!!!, error is: ", err)
			log.Warnf("Invalid event from user %d: %v", client.UserID, err)
			continue
		}
		fmt.Println("activity_id>>>>>>", event.OpenContentActivityID)
		fmt.Println("userId>>>>>>", event.UserID)
		srv.Db.UpdateOpenContentActivityStopTS(event.OpenContentActivityID)
		// // Handle events
		// if event.EventType == "page_visit" {
		// 	fmt.Println("User", client.UserID, "visited page ", event.Page)
		// 	client.activePage = event.Page
		// } else if event.EventType == "disconnect" {
		// 	log.Infof("User %d disconnected from page %s", client.UserID, client.activePage)
		// 	srv.wsClient.removeClient(client.UserID, client, "User left")
		// }
	}
}

func (srv *Server) handleWsHeartbeat(client *WsClient) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-client.ctx.Done():
			return
		case <-ticker.C:
			log.Info("sending ping???")
			if err := client.Conn.Ping(client.ctx); err != nil {
				log.Errorf("Failed to send ping: %v", err)
				srv.wsClient.removeClient(client.UserID, client, "ping failed")
				return
			}
		}
	}
}
