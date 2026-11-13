import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { QRCodeSVG } from "qrcode.react";
import "../styling/home.css";

function Home() {
  const [nickname, setNickname] = useState("");
  const [playerList, setPlayerList] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [player, setPlayer] = useState(() => {
    const saved = localStorage.getItem("bday_trivia_player");
    return saved ? JSON.parse(saved) : null;
  });

  const navigate = useNavigate();
  const dialogRef = useRef(null);

  // Open or close the modal automatically based on whether 'player' exists
  useEffect(() => {
    if (!player) dialogRef.current?.showModal();
  }, [player]);

  useEffect(() => {
    socket.emit("get_players");

    const handleSessionCreated = (newPlayer) => {
      setPlayer(newPlayer);
      localStorage.setItem("bday_trivia_player", JSON.stringify(newPlayer));
    };
    const handleSessionRestored = (restoredPlayer) => {
      setPlayer(restoredPlayer);
      localStorage.setItem("bday_trivia_player", JSON.stringify(restoredPlayer));
    };
    const handleSessionExpired = () => {
      localStorage.removeItem("bday_trivia_player");
      setPlayer(null);
    };
    const handleLobbyUpdated = (data) => {
      setPlayerList(data?.players || []);
      if (data?.hostId !== undefined) setHostId(data.hostId);
    };
    // Everyone (not just the host) goes to /game when the first question starts.
    // We pass the data along because the event has already fired by the time Game mounts.
    const handleQuestionStarted = (data) => navigate("/game", { state: data });

    socket.on("session_created", handleSessionCreated);
    socket.on("session_restored", handleSessionRestored);
    socket.on("session_expired", handleSessionExpired);
    socket.on("lobby_updated", handleLobbyUpdated);
    socket.on("question_started", handleQuestionStarted);

    return () => {
      socket.off("session_created", handleSessionCreated);
      socket.off("session_restored", handleSessionRestored);
      socket.off("session_expired", handleSessionExpired);
      socket.off("lobby_updated", handleLobbyUpdated);
      socket.off("question_started", handleQuestionStarted);
    };
  }, [navigate]);

  const handleJoin = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    socket.emit("join_game", { nickname: nickname.trim() });
  };

  const handleStartGame = () => {
    socket.emit("start_game", { playerId: player.id });
  };

  const handleClearLobby = () => {
    if (window.confirm("Clear all players and reset the lobby?")) {
      socket.emit("reset_game");
    }
  };

  const isHost = player && player.id === hostId;

  return (
    <section className="page">
      <div className="page-header">
        <h2>Justin Birthday Trivia!</h2>
      </div>

      <hr />

      <div className="page-body">
        {!player && (
          <dialog
            id="nicknamePopup"
            ref={dialogRef}
            onCancel={(e) => e.preventDefault()}
          >
            <form id="nicknameForm" onSubmit={handleJoin}>
              <input
                id="nicknameInput"
                type="text"
                placeholder="Nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
              />
              <button type="submit">Okay, go</button>
            </form>
          </dialog>
        )}

        {player && (
          <div className="waiting-lobby">
            {isHost ? (
              <div className="host-controls">
                <div className="qr-box">
                  <QRCodeSVG value={window.location.origin} size={220} />
                  <p>Scan to join!</p>
                </div>
                <p className="lobby-status">
                  You are the host (<strong>{player.nickname}</strong>)!
                </p>
                <button className="primary-btn" onClick={handleStartGame}>Start Game</button>
                <button className="danger-btn" onClick={handleClearLobby}>Clear All Names</button>
              </div>
            ) : (
              <p className="lobby-status">
                You're in as <strong>{player.nickname}</strong>! Waiting for the host to start...
              </p>
            )}

            <h3>Players Joined ({playerList.length})</h3>

            <div className="player-grid">
              {playerList.map((p) => (
                <div
                  key={p.id}
                  className={`player-card ${p.id === player.id ? "is-me" : ""}`}
                >
                  {p.nickname} {p.id === hostId ? "👑" : ""}{" "}
                  {p.id === player.id ? "(You)" : ""}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Home;