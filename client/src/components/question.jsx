import { useState, useEffect } from "react";
import "../styling/game.css";

function Question({ question, questionNumber, totalQuestions, deadline, selected, correctAnswers, onAnswer }) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const revealed = correctAnswers !== null;

  // Countdown: recompute from the deadline 4x/second so it never drifts.
  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  const styleFor = (index) => {
    if (revealed) {
      if (correctAnswers.includes(index)) return { background: "#2e7d32", opacity: 1 }; // right answer(s)
      if (index === selected) return { background: "#c62828", opacity: 1 };             // your wrong pick
      return { opacity: 0.35 };                                                          // everything else fades
    }
    if (selected === null) return {};
    return index === selected ? { outline: "4px solid white" } : { opacity: 0.5 };
  };

  return (
    <div>
        <div className="question-meta">
        <span>Question {questionNumber} of {totalQuestions}</span>
        {!revealed && <span className="timer">⏱ {secondsLeft}</span>}
        </div>
        <h1 className="question-text">{question.text}</h1>

        <div className="options">
        {question.options.map((option, index) => (
            <button key={index} className={`option-btn option-${index}`} style={styleFor(index)} disabled={selected !== null || revealed}    onClick={() => onAnswer(index)}>{option}</button>
        ))}
        </div>
    </div>
    );
}

export default Question;