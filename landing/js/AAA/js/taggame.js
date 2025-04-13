const sceneEl = document.querySelector("a-scene")
const hiddenMickeyEl = document.querySelector("#hiddenmickey")
const scoreEl = document.querySelector('#score-element');

function randomPosition() {
  return {
    x: (Math.random() - 0.5) * 20,
    y: 0.w5,
    z: (Math.random() - 0.5) * 20
  };
}

let score = 0;

function displayScore() {
  scoreEl.setAttribute('value', `Skor: ${score}`);
}

function createHiddenMickey(){
  const clone = hiddenMickeyEl.cloneNode(true);
  clone.setAttribute("position", randomPosition())
  clone.addEventListener('mousedown', () => {
    score++;
    clone.dispatchEvent(new Event('collected'));
    displayScore();
  })
  clone.addEventListener('animationcomplete', () => {
    clone.setAttribute("position", randomPosition());
  });
  sceneEl.appendChild(clone)
}

for(let i=0 ; i<15; i++){
  createHiddenMickey()
}
displayScore()
