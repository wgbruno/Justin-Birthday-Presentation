import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/home";
import Game from "./pages/game"

import './App.css'

function App() {
  return (
    <BrowserRouter>
      <main className="app-main">
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/game" element={<Game />} />
          <Route path="*" element={<Navigate to="/home" replace />} /> 
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
