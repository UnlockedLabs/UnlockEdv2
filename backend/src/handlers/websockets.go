package handlers

import (
	"UnlockEdv2/src/database"
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
	log "github.com/sirupsen/logrus"
)

func (srv *Server) registerWebsocketRoute() {
	srv.Mux.Handle("/api/ws/listen", srv.authMiddleware(srv.handleError(srv.handleWebsocketConnection)))
}

const (
	bytesBuffer = 256
)

type WsEventType string

const (
	ClientHello   WsEventType = "client_hello"
	ClientGoodbye WsEventType = "client_goodbye"
	VisitEvent    WsEventType = "visits"
	BookmarkEvent WsEventType = "bookmarks"
)

type MsgContent struct {
	ActivityID int64  `json:"activity_id"`
	Msg        string `json:"msg"`
}

type WsMsg struct {
	EventType WsEventType `json:"event_type"`
	UserID    uint        `json:"user_id"`
	SessionID string      `json:"session_id"`
	Msg       MsgContent  `json:"msg"`
}

func (ws *WsMsg) getClientKey() uint {
	return ws.UserID
}

type WsClient struct {
	Conn                  *websocket.Conn
	UserID                uint
	EventType             WsEventType
	SessionID             string
	OpenContentActivityID int64
	ctx                   context.Context
	cancel                context.CancelFunc
	sendChan              chan []byte
	mutex                 sync.Mutex
}

func (ws *WsClient) getClientKey() uint {
	return ws.UserID
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

func (cm *ClientManager) addClient(client *WsClient) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	clientKey := client.getClientKey()
	if cm.clients[clientKey] == nil {
		cm.clients[clientKey] = client
		log.Infof("Added client with key/user_id %d", clientKey)
	} else {
		log.Warnf("Client already existed with key/user_id %d", clientKey)
	}
}

func (cm *ClientManager) removeClient(client *WsClient, reason string) {
	cm.mutex.Lock()
	defer cm.mutex.Unlock()
	if client.Conn == nil {
		log.Warn("Connection already closed, skipping removal.")
		return
	}
	clientKey := client.getClientKey()
	if cm.clients[clientKey] != nil {
		log.Infof("Removing client key/user_id %d", clientKey)
		err := client.Conn.Close(websocket.StatusNormalClosure, reason)
		if err != nil {
			log.Errorf("Failed to close connection: %v", err)
		}
		delete(cm.clients, clientKey)
		client.Conn = nil
		client.cancel()
	}
}

func (cm *ClientManager) notifyUser(event WsMsg) {
	clientKey := event.getClientKey()
	cm.mutex.RLock()
	client, exists := cm.clients[clientKey]
	cm.mutex.RUnlock()
	if exists {
		client.mutex.Lock()
		defer client.mutex.Unlock()
		client.send(event)
		return
	}
}

func (client *WsClient) send(event WsMsg) {
	log.Infof("Sending message to user_id %d, message: %s, activityID: %d", client.UserID, event.Msg.Msg, event.Msg.ActivityID)
	if event.Msg.ActivityID > 0 {
		client.OpenContentActivityID = event.Msg.ActivityID
	}
	response, err := json.Marshal(event)
	if err != nil {
		log.Errorf("Failed to marshal event: %v", err)
		return
	}
	client.sendChan <- response
}

func (client *WsClient) writePump() {
	for {
		select {
		case message := <-client.sendChan:
			log.Infof("Writing message to user_id %d", client.UserID)
			err := client.Conn.Write(client.ctx, websocket.MessageText, message)
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
	srv.handleIfClientExists(client, "connected from a different device or tab")
	srv.wsClient.addClient(client)
	go client.writePump()
	go srv.handleWsHeartbeat(client)
	go srv.handleWsReader(ctx, client)
	<-ctx.Done()
	srv.wsClient.removeClient(client, "")
	return nil
}

func (cm *ClientManager) handleCleanup(db *database.DB, clientKey uint) {
	cm.mutex.RLock()
	defer cm.mutex.RUnlock()
	client, ok := cm.clients[clientKey]
	if !ok {
		return
	}
	if client.SessionID != "" {
		db.LogUserSessionEnded(client.UserID, client.SessionID)
	}
	if client.OpenContentActivityID > 0 {
		db.UpdateOpenContentActivityStopTS(client.OpenContentActivityID)
	}
}

func (srv *Server) handleIfClientExists(client *WsClient, reason string) {
	clientKey := client.getClientKey()
	existingClient, exists := srv.wsClient.clients[clientKey]
	if exists {
		log.Warnf("client exists for key/user_id %d. Closing connection.", clientKey)
		srv.wsClient.handleCleanup(srv.Db, clientKey)
		srv.wsClient.removeClient(existingClient, reason)
	}
}

func (srv *Server) handleWsReader(ctx context.Context, client *WsClient) {
	defer client.cancel()
	for {
		_, msg, err := client.Conn.Read(ctx)
		if err != nil { //if there was an error then we should attempt a clean up
			if websocket.CloseStatus(err) == websocket.StatusNormalClosure ||
				websocket.CloseStatus(err) == websocket.StatusGoingAway {
				log.Info("WebSocket connection closed by client")
				srv.handleIfClientExists(client, "websocket closed, unable to read message")
			} else {
				log.Warnf("Error reading from WebSocket, due to frontend closure")
			}
			srv.wsClient.removeClient(client, "websocket closed, unable to read message")
			return
		}
		var event WsMsg
		if err := json.Unmarshal(msg, &event); err != nil {
			log.Warnf("Invalid message event from user %d: %v", client.UserID, err)
			continue
		}
		switch event.EventType {
		case VisitEvent:
			srv.Db.UpdateOpenContentActivityStopTS(event.Msg.ActivityID)
		case ClientGoodbye:
			srv.Db.LogUserSessionEnded(event.UserID, event.SessionID)
		case ClientHello:
			client.SessionID = event.SessionID
			srv.Db.LogUserSessionStarted(client.UserID, event.SessionID)
		default:
			log.Warnf("Invalid event type %s", event.EventType)
		}
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
			log.Info("sending ping...")
			if err := client.Conn.Ping(client.ctx); err != nil {
				log.Errorf("Failed to send ping: %v", err)
				srv.wsClient.removeClient(client, "ping failed")
				return
			}
		}
	}
}
