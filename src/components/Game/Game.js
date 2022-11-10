import { useParams } from "react-router-dom";
import Swal from "sweetalert2";
import React, { useState } from "react";
import "./Game.scss";
import {
  Stack,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
} from "@mui/material";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import audioPiece from "../../assets/sounds/addPieceMove.mp3";
import audioWin from "../../assets/sounds/win.mp3";
import audioRematch from "../../assets/sounds/rematch.mp3";
import audioChat from "../../assets/sounds/chat.mp3";
import audioWinMatch from "../../assets/sounds/winMatch.mp3";
import audioStart from "../../assets/sounds/start.mp3";
import audioDesconection from "../../assets/sounds/desconection.mp3";
import audioDraw from "../../assets/sounds/draw.mp3";

const baseUrl = process.env.REACT_APP_4_IN_ROW_BASE_URL;

const URL_GAME = `${baseUrl}/ws_game`;
const ws_game = new WebSocket(URL_GAME);
const playerId = (Math.random() + 1).toString(36).substring(7);
let rematchConfirm = false;
let currentTimerVersion = null;
let timerStop = false;
let gameEnd = false;
let initial = {};
for (var c = 0; c < 7; c++) {
  initial[c] = [null, null, null, null, null, null];
}

export default function Game() {
  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
  const [name, setName] = useState(useParams().nick);
  // eslint-disable-next-line no-unused-vars
  const [gameId, setGameId] = useState(useParams().gameId);
  const [board, setBoard] = useState(initial);
  const [chat, setChat] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [turn, setTurn] = useState(null);
  const [players, setPlayers] = useState({});
  const [playerNumber, setPlayerNumber] = useState(null);
  const [timer, setTimer] = useState(45);

  ws_game.onopen = () => {
    ws_game.send(
      CreateMessageGame(gameId, `${name};${playerId}`, `ADD ME TO GAME`)
    );

    ws_game.onmessage = (e) => {
      HandleMessageGame(JSON.parse(e.data));
    };

    ws_game.onclose = (e) => {
      SwalDisconnect();
    };
  };

  const changeTimer = async (version, timer, pData, tData) => {
    if (currentTimerVersion === version && !timerStop) {
      setTimer(timer);
      if (timer === 0) {
        SwalEndTimer(pData, tData);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        changeTimer(version, timer - 1, pData, tData);
      }
    }
  };

  const HandleMessageGame = async (message) => {
    if (message.detail === "WAITING") {
      SwalWaiting();
    } else if (message.detail === "READY") {
      const player1Name = message.data[0].split(";")[0];
      const player1Id = message.data[0].split(";")[1];
      const player2Name = message.data[1].split(";")[0];
      const player2Id = message.data[1].split(";")[1];
      const initialTurn = message.data[2];

      setPlayers({
        player1Name: player1Name,
        player1Id: player1Id,
        player1Wins: 0,
        player2Name: player2Name,
        player2Id: player2Id,
        player2Wins: 0,
      });

      if (playerId === player1Id) {
        setPlayerNumber(1);
        setName(player1Name);
      } else if (playerId === player2Id) {
        setPlayerNumber(2);
        setName(player2Name);
      }

      initTurn(initialTurn);

      SwalStart(
        changeTimer,
        {
          player1Name: player1Name,
          player1Id: player1Id,
          player1Wins: 0,
          player2Name: player2Name,
          player2Id: player2Id,
          player2Wins: 0,
        },
        initialTurn
      );
    } else if (message.detail === "DISCONNECT") {
      SwalDisconnectOpponent();
    } else if (message.detail === "CHAT") {
      const user = message.data.user;
      const text = message.data.text;
      setChat((chat) => [...chat, { user: user, text: text }]);
    } else if (message.detail === "MOVE") {
      const pieceData = message.data[0];
      const playerNumberData = message.data[1];
      const turnData = message.data[2];
      let playersData = message.data[3];
      addPiece(pieceData, playerNumberData);
      const roundResult = roundOver();
      const roundResultEvaluate = roundResult[0];
      const roundResultColorWin = roundResult[1];
      const roundResultWinRow = roundResult[2];
      if (roundResultEvaluate) {
        timerStop = true;
        if (roundResultColorWin !== "DRAW") {
          PrintWinRow(roundResultWinRow);
          await new Promise((resolve) => setTimeout(resolve, 2500));
          playersData = addWinToPlayer(roundResultColorWin, playersData);
          SwalRoundWinner(
            roundResultColorWin,
            playersData,
            SwalRematch,
            resetBoard
          );
        } else {
          SwalDraw(resetBoard);
        }
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      changeTurn(turnData, playersData);
    } else {
      // REMATCH
      const rematchAcceptedIncomingValue = message.data[0];
      const rematchPlayersIncomingValue = message.data[1];
      if (!rematchAcceptedIncomingValue) {
        // REMATCH NOT ACCEPTED
        window.location = window.location.origin;
      } else if (rematchConfirm) {
        // REMATCH START
        setPlayers({
          ...rematchPlayersIncomingValue,
          player1Wins: 0,
          player2Wins: 0,
        });
        resetBoard();
        const newInitialTurn = Math.floor(Math.random() * (2 - 1 + 1) + 1);
        initTurn(newInitialTurn);
        gameEnd = false;
        rematchConfirm = false;
        SwalStart(
          changeTimer,
          {
            ...rematchPlayersIncomingValue,
            player1Wins: 0,
            player2Wins: 0,
          },
          newInitialTurn
        );
      } else {
        // REMATCH CONFIRM
        rematchConfirm = true;
      }
    }
  };

  const changeTurn = (t, pData) => {
    let tData = t;
    if (t === 1) {
      setTurn(2);
      tData = 2;
    } else {
      setTurn(1);
      tData = 1;
    }
    currentTimerVersion += 1;
    if (!gameEnd) {
      timerStop = false;
    }
    changeTimer(currentTimerVersion, 45, pData, tData);
  };

  const initTurn = (initial) => {
    setTurn(initial);
  };

  const sendMessageChat = () => {
    soundChat();
    ws_game.send(
      CreateMessageGame(gameId, { user: name, text: `${chatMessage}` }, "CHAT")
    );
    setChatMessage("");
  };

  const handleChangeChatMessage = (e) => {
    setChatMessage(e.target.value);
  };

  const handleKeypress = (e) => {
    if (e.key === "Enter") {
      sendMessageChat();
    }
  };

  const Chat = () => {
    return (
      <Stack
        direction="row"
        justifyContent="left"
        ml={132}
        mr={2}
        mt={-10.5}
        mb={-18}
      >
        <Grid
          style={{ textAlign: "left" }}
          sx={{
            width: "100%",
            maxWidth: 370,
            minWidth: 350,

            bgcolor: "background.paper",
            position: "relative",
            overflow: "auto",
            height: 240,
            marginBottom: 3.5,
            border: 1,
            borderRadius: 2,
            "& ul": { padding: 0 },
          }}
        >
          <div>
            <Card
              style={{ background: "#CDCCFF" }}
              md={4}
              sx={{
                minHeight: 237,
              }}
            >
              <h2>Chat</h2>
              <CardContent>
                {chat.map((message) => (
                  <Stack direction="row" justifyContent="left" mt={0.5}>
                    <b>{message.user}</b>: {message.text}
                  </Stack>
                ))}
                <Stack direction="row" justifyContent="left" mt={2.7} mb={-29}>
                  <TextField
                    style={{ background: "#EBEDEF" }}
                    sx={{
                      width: "95%",
                    }}
                    label="Mensaje"
                    onChange={handleChangeChatMessage}
                    onKeyPress={handleKeypress}
                    value={chatMessage}
                  />
                </Stack>
                <Stack
                  direction="row"
                  justifyContent="center"
                  mt={30}
                  mb={-1}
                  onClick={() => sendMessageChat()}
                >
                  <Button variant="contained" size="small">
                    enviar
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </div>
        </Grid>
      </Stack>
    );
  };

  const GameColumn = ({ col, idx, onClick }) => {
    return (
      <div className="column" key={`col-${idx}`} onClick={onClick}>
        {col.map((cell, x) => {
          return (
            <span className="cell" key={`cell-${idx}-${x}`}>
              {cell}
            </span>
          );
        })}
      </div>
    );
  };

  const roundOver = () => {
    const isYellow = (piece) => {
      return piece !== null && piece.props.className === "amarillo";
    };
    const isRed = (piece) => {
      return piece !== null && piece.props.className === "rojo";
    };
    // game over vertical:
    for (let c = 0; c <= 6; c++) {
      for (let r = 0; r <= 2; r++) {
        if (
          isRed(board[c][r]) &&
          isRed(board[c][r + 1]) &&
          isRed(board[c][r + 2]) &&
          isRed(board[c][r + 3])
        ) {
          return [
            true,
            "rojo",
            [
              [c, r],
              [c, r + 1],
              [c, r + 2],
              [c, r + 3],
            ],
          ];
        }
        if (
          isYellow(board[c][r]) &&
          isYellow(board[c][r + 1]) &&
          isYellow(board[c][r + 2]) &&
          isYellow(board[c][r + 3])
        ) {
          return [
            true,
            "amarillo",
            [
              [c, r],
              [c, r + 1],
              [c, r + 2],
              [c, r + 3],
            ],
          ];
        }
      }
    }

    // game over horizontal:
    for (let c = 0; c <= 3; c++) {
      for (let r = 0; r <= 5; r++) {
        if (
          isRed(board[c][r]) &&
          isRed(board[c + 1][r]) &&
          isRed(board[c + 2][r]) &&
          isRed(board[c + 3][r])
        ) {
          return [
            true,
            "rojo",
            [
              [c, r],
              [c + 1, r],
              [c + 2, r],
              [c + 3, r],
            ],
          ];
        }
        if (
          isYellow(board[c][r]) &&
          isYellow(board[c + 1][r]) &&
          isYellow(board[c + 2][r]) &&
          isYellow(board[c + 3][r])
        ) {
          return [
            true,
            "amarillo",
            [
              [c, r],
              [c + 1, r],
              [c + 2, r],
              [c + 3, r],
            ],
          ];
        }
      }
    }

    // game over diagonal:
    for (let c = 0; c <= 6; c++) {
      for (let r = 0; r <= 5; r++) {
        if (c >= 3 && r >= 3) {
          if (
            isRed(board[c][r]) &&
            isRed(board[c - 1][r - 1]) &&
            isRed(board[c - 2][r - 2]) &&
            isRed(board[c - 3][r - 3])
          ) {
            return [
              true,
              "rojo",
              [
                [c, r],
                [c - 1, r - 1],
                [c - 2, r - 2],
                [c - 3, r - 3],
              ],
            ];
          }
          if (
            isYellow(board[c][r]) &&
            isYellow(board[c - 1][r - 1]) &&
            isYellow(board[c - 2][r - 2]) &&
            isYellow(board[c - 3][r - 3])
          ) {
            return [
              true,
              "amarillo",
              [
                [c, r],
                [c - 1, r - 1],
                [c - 2, r - 2],
                [c - 3, r - 3],
              ],
            ];
          }
        }

        if (c >= 3 && r <= 2) {
          if (
            isRed(board[c][r]) &&
            isRed(board[c - 1][r + 1]) &&
            isRed(board[c - 2][r + 2]) &&
            isRed(board[c - 3][r + 3])
          ) {
            return [
              true,
              "rojo",
              [
                [c, r],
                [c - 1, r + 1],
                [c - 2, r + 2],
                [c - 3, r + 3],
              ],
            ];
          }
          if (
            isYellow(board[c][r]) &&
            isYellow(board[c - 1][r + 1]) &&
            isYellow(board[c - 2][r + 2]) &&
            isYellow(board[c - 3][r + 3])
          ) {
            return [
              true,
              "amarillo",
              [
                [c, r],
                [c - 1, r + 1],
                [c - 2, r + 2],
                [c - 3, r + 3],
              ],
            ];
          }
        }

        if (c <= 3 && r <= 2) {
          if (
            isRed(board[c][r]) &&
            isRed(board[c + 1][r + 1]) &&
            isRed(board[c + 2][r + 2]) &&
            isRed(board[c + 3][r + 3])
          ) {
            return [
              true,
              "rojo",
              [
                [c, r],
                [c + 1, r + 1],
                [c + 2, r + 2],
                [c + 3, r + 3],
              ],
            ];
          }
          if (
            isYellow(board[c][r]) &&
            isYellow(board[c + 1][r + 1]) &&
            isYellow(board[c + 2][r + 2]) &&
            isYellow(board[c + 3][r + 3])
          ) {
            return [
              true,
              "amarillo",
              [
                [c, r],
                [c + 1, r + 1],
                [c + 2, r + 2],
                [c + 3, r + 3],
              ],
            ];
          }
        }

        if (c <= 3 && r >= 3) {
          if (
            isRed(board[c][r]) &&
            isRed(board[c + 1][r - 1]) &&
            isRed(board[c + 2][r - 2]) &&
            isRed(board[c + 3][r - 3])
          ) {
            return [
              true,
              "rojo",
              [
                [c, r],
                [c + 1, r - 1],
                [c + 2, r - 2],
                [c + 3, r - 3],
              ],
            ];
          }
          if (
            isYellow(board[c][r]) &&
            isYellow(board[c + 1][r - 1]) &&
            isYellow(board[c + 2][r - 2]) &&
            isYellow(board[c + 3][r - 3])
          ) {
            return [
              true,
              "amarillo",
              [
                [c, r],
                [c + 1, r - 1],
                [c + 2, r - 2],
                [c + 3, r - 3],
              ],
            ];
          }
        }
      }

      // game over draw
      let count = 0;
      for (let c = 0; c <= 6; c++) {
        for (let r = 0; r <= 5; r++) {
          if (isRed(board[c][r]) || isYellow(board[c][r])) {
            count += 1;
          } else {
            break;
          }
        }
      }
      if (count === 42) {
        return [true, "DRAW", null];
      }
    }

    return [false, null, null];
  };

  const sendMove = (columnIdx, pNro, t, p) => {
    if (pNro === t) {
      changeTurn(t);
      ws_game.send(CreateMessageGame(gameId, [columnIdx, pNro, t, p], "MOVE"));
    }
  };

  const addPiece = (columnIdx, pNro) => {
    const column = board[columnIdx];
    const piecePos = column.indexOf(null);
    let piece;
    const red_piece = <div className="rojo"></div>;
    const yellow_piece = <div className="amarillo"></div>;

    if (pNro === 1) {
      piece = red_piece;
    } else if (pNro === 2) {
      piece = yellow_piece;
    }
    column[piecePos] = piece;
    setBoard({
      ...board,
      [columnIdx]: column,
    });
    soundPiece();
  };

  const resetBoard = () => {
    for (let c = 0; c <= 6; c++) {
      for (let r = 0; r <= 5; r++) {
        const column = board[c];
        column[r] = null;
        setBoard({ ...board, [r]: column });
      }
    }
  };

  const addWinToPlayer = (winnerColor, p) => {
    let newPlayersData = {};
    if (winnerColor === "rojo") {
      newPlayersData = {
        player1Name: p.player1Name,
        player1Id: p.player1Id,
        player1Wins: p.player1Wins + 1,
        player2Name: p.player2Name,
        player2Id: p.player2Id,
        player2Wins: p.player2Wins,
      };
    } else {
      newPlayersData = {
        player1Name: p.player1Name,
        player1Id: p.player1Id,
        player1Wins: p.player1Wins,
        player2Name: p.player2Name,
        player2Id: p.player2Id,
        player2Wins: p.player2Wins + 1,
      };
    }
    setPlayers(newPlayersData);
    return newPlayersData;
  };

  const PrintWinRow = (winRow) => {
    const piece = <div className="verde"></div>;
    for (let i = 0; i < winRow.length; i++) {
      const column = board[winRow[i][0]];
      column[winRow[i][1]] = piece;
      setBoard({ ...board, [winRow[i][0]]: column });
    }
  };

  const SwalRematch = (pData) => {
    soundRematch();
    return Swal.fire({
      title: `Revancha?`,
      heightAuto: false,
      allowOutsideClick: false,
      showCancelButton: true,
      showConfirmButton: true,
      confirmButtonText: "Si",
      cancelButtonText: "No",
      confirmButtonColor: "green",
      cancelButtonColor: "red",
      backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
    }).then((result) => {
      ws_game.send(
        CreateMessageGame(gameId, [result.isConfirmed, pData], "REMATCH")
      );
      if (result.isConfirmed) {
        SwalRematchWaiting();
      }
    });
  };

  const SwalEndTimer = async (pData, tData) => {
    timerStop = true;
    let roundResultColorWin = null;
    if (tData === 1) {
      roundResultColorWin = "amarillo";
    } else {
      roundResultColorWin = "rojo";
    }
    const playersData = addWinToPlayer(roundResultColorWin, pData);
    SwalRoundWinner(roundResultColorWin, playersData, SwalRematch, resetBoard);
    await new Promise((resolve) => setTimeout(resolve, 2500));
    changeTurn(tData, playersData);
  };

  const soundPiece = () => {
    new Audio(audioPiece).play();
  };

  const soundRematch = () => {
    new Audio(audioRematch).play();
  };

  const soundChat = () => {
    new Audio(audioChat).play();
  };

  const ConnectFourGame = () => {
    return (
      <div className="board">
        {Object.entries(board).map(([k, col], x) => {
          return (
            <GameColumn
              col={col}
              idx={x}
              onClick={() => sendMove(x, playerNumber, turn, players)}
            />
          );
        })}
      </div>
    );
  };

  const Timer = () => {
    return <h1>{timer}</h1>;
  };

  const Contador1 = () => {
    if (players.player1Wins === 1) {
      return <ShowMatch1 />;
    } else if (players.player1Wins === 2) {
      return <ShowMatch2 />;
    } else if (players.player1Wins === 3) {
      return <ShowMatch3 />;
    } else {
      return <ShowMatch0 />;
    }
  };

  const Contador2 = () => {
    if (players.player2Wins === 1) {
      return <ShowMatch1 />;
    } else if (players.player2Wins === 2) {
      return <ShowMatch2 />;
    } else if (players.player2Wins === 3) {
      return <ShowMatch3 />;
    } else {
      return <ShowMatch0 />;
    }
  };

  const ShowMatch0 = () => {
    return (
      <h2 style={{ margin: 5 }}>
        <div className="contador"></div>
        <div className="contador"></div>
        <div className="contador"></div>
      </h2>
    );
  };

  const ShowMatch1 = () => {
    return (
      <h2 style={{ margin: 5 }}>
        <div className="contadorWin"></div>
        <div className="contador"></div>
        <div className="contador"></div>
      </h2>
    );
  };

  const ShowMatch2 = () => {
    return (
      <h2 style={{ margin: 5 }}>
        <div className="contadorWin"></div>
        <div className="contadorWin"></div>
        <div className="contador"></div>
      </h2>
    );
  };

  const ShowMatch3 = () => {
    return (
      <h2 style={{ margin: 5 }}>
        <div className="contadorWin"></div>
        <div className="contadorWin"></div>
        <div className="contadorWin"></div>
      </h2>
    );
  };

  return (
    <main className="game">
      <Paper>
        <h1>4 EN LÍNEA</h1>
      </Paper>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          fontSize: 18,
          "& > :not(style)": {
            mt: 0.8,
            mx: 0.3,
            width: 308,
            height: 250,
          },
        }}
      >
        <Grid
          sx={{
            width: "100%",
            position: "inherit",
            maxHeight: 300,
            "& ul": { padding: 0 },
          }}
        >
          <div>
            <Paper
              sx={{
                mt: 3,
                ml: 4,
                mr: 16,
              }}
            >
              <h3>
                <div className="rojoJugador"></div>
                <div>{players.player1Name}</div>
                <div>
                  <Contador1 />
                </div>
              </h3>
            </Paper>
            <Paper
              sx={{
                mt: 4,
                ml: 4,
                mr: 16,
              }}
            >
              <h3>
                <div className="amarilloJugador"></div>
                <div>{players.player2Name}</div>
                <div>
                  <Contador2 />
                </div>
              </h3>
            </Paper>
            <Paper
              sx={{
                mt: 12,
                ml: 4,
                mr: 16,
              }}
            >
              <h4>Tiempo restante:</h4>
              <Timer />
            </Paper>
            <Paper
              sx={{
                mt: -66.5,
                ml: 26.5,
                mr: 15,
              }}
            >
              {ConnectFourGame()}
            </Paper>
          </div>
        </Grid>
      </Box>
      {Chat()}
    </main>
  );
}

const CreateMessageGame = (gameId, data, detail) => {
  return JSON.stringify({
    gameId: gameId,
    data: data,
    detail: detail,
  });
};

const SwalWaiting = () => {
  return Swal.fire({
    title: "Conectando...",
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading();
    },
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  });
};

const SwalStart = (changeTimer, pData, tData) => {
  soundStart();
  const SwalStartAction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    currentTimerVersion = 0;
    timerStop = false;
    changeTimer(0, 45, pData, tData);
  };

  SwalStartAction();

  return Swal.fire({
    icon: "warning",
    title: "Comienza el juego",
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    timer: 2500,
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  });
};

const soundStart = () => {
  new Audio(audioStart).play();
};

const SwalDisconnect = () => {
  const SwalDisconnectAction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    window.location = window.location.origin;
  };

  SwalDisconnectAction();

  return Swal.fire({
    icon: "error",
    title: "Se ha perdido la conexion",
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    timer: 2500,
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  });
};

const SwalDisconnectOpponent = () => {
  soundDesconection();
  const SwalDisconnectOpponentAction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    window.location = window.location.origin;
  };

  SwalDisconnectOpponentAction();

  return Swal.fire({
    icon: "error",
    title: "Tu oponente se ha desconectado",
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    timer: 2500,
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  });
};

const soundDesconection = () => {
  new Audio(audioDesconection).play();
};

const SwalRoundWinner = (winnerColor, pData, swalRematch, resetBoard) => {
  let winnerRoundName;
  if (winnerColor === "rojo") {
    winnerRoundName = pData.player1Name;
  } else {
    winnerRoundName = pData.player2Name;
  }
  soundWin();

  const SwalRoundWinnerAction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    resetBoard();
    if (pData.player1Wins === 3 || pData.player2Wins === 3) {
      gameEnd = true;
      SwalPlayerWinner(winnerRoundName, swalRematch, pData);
    }
  };

  SwalRoundWinnerAction();

  return Swal.fire({
    title: `${winnerRoundName} gana la ronda!`,
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    timer: 2500,
  });
};

const SwalPlayerWinner = (pName, swalRematch, pData) => {
  soundWinMatch();
  const SwalPlayerWinnerAction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    swalRematch(pData);
  };

  SwalPlayerWinnerAction();

  return Swal.fire({
    title: `${pName} gana la partida!`,
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    timer: 2500,
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  });
};

const soundWin = () => {
  new Audio(audioWin).play();
};

const soundWinMatch = () => {
  new Audio(audioWinMatch).play();
};

const SwalDraw = (resetBoard) => {
  soundDraw();
  const SwalDrawAction = async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    resetBoard();
  };

  SwalDrawAction();

  return Swal.fire({
    title: `Empate!`,
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    timer: 2500,
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  });
};

const soundDraw = () => {
  new Audio(audioDraw).play();
};

const SwalRematchWaiting = () => {
  return Swal.fire({
    title: `Esperando confirmacion de oponente...`,
    heightAuto: false,
    allowOutsideClick: false,
    showCancelButton: false,
    showConfirmButton: false,
    backdrop: `
    rgba(0, 0, 0, 0.8)
    left top
    no-repeat
  `,
  });
};
