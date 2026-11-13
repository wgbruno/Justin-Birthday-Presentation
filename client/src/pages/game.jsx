import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { socket } from "../socket";

import Question from "../components/question.jsx";

function Game() {
  const initial = useLocation().state; // question data passed in from Home
  const playerId = JSON.parse(localStorage.getItem("bday_trivia_player"))?.id;

  const [currentQuestion, setCurrentQuestion] = useState(initial?.question || null);
  const [questionNumber, setQuestionNumber] = useState(initial?.questionNumber || 1);
  const [totalQuestions, setTotalQuestions] = useState(initial?.totalQuestions || 0);
  // Convert "ms remaining" into a deadline on THIS device's clock.
  const [deadline, setDeadline] = useState(initial ? Date.now() + initial.remainingMs : 0);
  const [gameState, setGameState] = useState("question"); // question | results | finished
  const [selected, setSelected] = useState(null);         // option index this player picked
  const [correctAnswers, setCorrectAnswers] = useState(null); // null until the reveal
  const [leaderboard, setLeaderboard] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [isLast, setIsLast] = useState(false);

  useEffect(() => {
    const onStarted = (data) => {
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setTotalQuestions(data.totalQuestions);
      setDeadline(Date.now() + data.remainingMs);
      setSelected(null);
      setCorrectAnswers(null);
      setGameState("question");
    };
    const onEnded = (data) => {
      setCorrectAnswers(data.correctAnswers);
      setLeaderboard(data.leaderboard);
      setHostId(data.hostId);
      setIsLast(data.isLast);
      setGameState("results");
    };
    const onOver = (data) => {
      setLeaderboard(data.leaderboard);
      setGameState("finished");
    };

    socket.on("question_started", onStarted);
    socket.on("question_ended", onEnded);
    socket.on("game_over", onOver);
    return () => {
      socket.off("question_started", onStarted);
      socket.off("question_ended", onEnded);
      socket.off("game_over", onOver);
    };
  }, []);

  const handleAnswer = (index) => {
    if (selected !== null || gameState !== "question") return; // one answer only
    setSelected(index);
    socket.emit("submit_answer", { playerId, answerIndex: index });
  };

  const handleNext = () => socket.emit("next_question", { playerId });

  if (gameState === "finished") {
  return (
    <section className="page">
      <div className="page-header"><h2>Final Scores 🎉</h2></div>
      <div className="card">
        <ol className="leaderboard">
          {leaderboard.map((p) => <li key={p.id}>{p.nickname}: {p.score}</li>)}
        </ol>
      </div>
    </section>
  );
}

if (!currentQuestion) return <p>Waiting for the question...</p>;

const me = leaderboard.find((p) => p.id === playerId);
const isHost = playerId === hostId;

return (
    <section className="page">
        <Question
        question={currentQuestion}
        questionNumber={questionNumber}
        totalQuestions={totalQuestions}
        deadline={deadline}
        selected={selected}
        correctAnswers={correctAnswers}
        onAnswer={handleAnswer}
        />

        {gameState === "results" && (
        <div className="card results">
            <h3 className="round-points">
            {me?.roundPoints ? `+${me.roundPoints} points!` : "No points this round"}
            </h3>
            <ol className="leaderboard">
            {leaderboard.slice(0, 5).map((p) => (
                <li key={p.id}>{p.nickname}: {p.score}</li>
            ))}
            </ol>

            {isHost ? (
            <button className="primary-btn" onClick={handleNext}>
                {isLast ? "Show Final Scores" : "Next Question"}
            </button>
            ) : (
            <p>Waiting for the host...</p>
            )}
        </div>
        )}
    </section>
    );
}

export default Game;