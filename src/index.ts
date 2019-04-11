import { Geometry } from 'planimetry'
import * as fpop from 'fpop'

function updateSize () {
  const width = window.innerWidth
  const height = window.innerHeight
  const root = document.getElementById('game') as HTMLDivElement
  root.style.width = width + 'px'
  root.style.height = height + 'px'

  const svg = root.querySelector('svg') as SVGSVGElement
  if (height / width > 1.6) {
    attr(svg, [['width', width * 0.9], ['height', (width * 1.6) * 0.9]])
  } else {
    attr(svg, [['height', height * 0.9], ['width', (height / 1.6) * 0.9]])
  }
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

function create<TName extends keyof SVGElementTagNameMap> (tagName: TName, attributes?: [string, any][]): SVGElementTagNameMap[TName] {
  const element = document.createElementNS(SVG_NAMESPACE, tagName)
  if (attributes != null) attr(element, attributes)
  return element
}

function attr<TElement extends SVGElement> (el: TElement, pairs: [string, any][]): TElement {
  pairs.forEach(([key, value]) => el.setAttribute(key, value))
  return el
}

interface State {
  ball: Geometry.Point.T,
  ballR: number
  velocity: Geometry.Point.T,
  passedTime: number
  gravity: Geometry.Point.T,
  leftHandle: Geometry.Point.T,
  rightHandle: Geometry.Point.T,
  handleR: number
  hasReachedPeak: boolean
  hasPassedThrough: boolean
}

function initDraw (root: HTMLElement, state: State) {
  const svg = create('svg', [
    ['width', 1000],
    ['height', 1600],
    ['viewBox', '0 0 100 160'],
    // ['preserveAspectRatio', 'xMidYMid meet'],
  ])

  const background = create('rect', [
    ['id', 'background'],
    ['x', 0],
    ['y', 0],
    ['width', '100%'],
    ['height', '100%'],
    ['rx', '5px'],
    ['ry', '5px'],
    ['fill', 'white'],
  ])

  const decorationOuter = create('rect', [
    ['x', 20],
    ['y', 40],
    ['width', 60],
    ['height', 35],
    ['rx', 3],
    ['ry', 3],
    ['stroke', '#999'],
    ['fill', 'white'],
  ])
  const decorationInner = create('rect', [
    ['x', 36],
    ['y', 52],
    ['width', 28],
    ['height', 18],
    ['rx', 3],
    ['ry', 3],
    ['stroke', '#999'],
    ['fill', 'white'],
  ])
  const line = create('line', [
    ['x1', state.leftHandle.x],
    ['y1', state.leftHandle.y],
    ['x2', state.rightHandle.x],
    ['y2', state.rightHandle.y],
    ['stroke-width', 2],
    ['stroke', '#FF4136'],
    ['stroke-linecap', 'round'],
  ])

  const ball = create('circle', [
    ['id', 'ball'],
    ['cx', state.ball.x],
    ['cy', state.ball.y],
    ['r', state.ballR],
    ['fill', '#EE863A'],
  ])

  svg.append(
    background,
    decorationOuter,
    decorationInner,
    line,
    ball,
  )

  root.appendChild(svg)
  updateSize()
}

function updateView (root: HTMLElement, state: State) {
  const svgCircle = root.querySelector('#ball') as SVGCircleElement
  if (svgCircle.previousElementSibling!.tagName.toLowerCase() == 'line' && state.hasReachedPeak) {
    svgCircle.parentElement!.insertBefore(svgCircle, svgCircle.previousElementSibling!)
  }

  attr(svgCircle, [
    ['cx', state.ball.x],
    ['cy', state.ball.y],
  ])
}

function destroyView (root: HTMLElement) {
  root.innerHTML = ''
}

function fire (click: Geometry.Point.T) {
  const direction = Geometry.Point.sub(click, state.ball)
  const angle = Math.atan2(direction.y, direction.x)
  const len = 5.5
  const x = len * Math.cos(angle)
  const y = len * Math.sin(angle)
  const velocity = Geometry.Point.New(x, y)
  loop({
    ...state,
    velocity,
  })()
}

function resolveCollisions (state: State): State {
  const handles = [state.leftHandle, state.rightHandle]

  for (const handle of handles) {
    const collision = Geometry.algorithms.circleCircleCollisionIntersectionPoint(
      state.ball,
      state.ballR,
      state.velocity,
      handle,
      state.handleR,
    )
    if (collision == null) continue

    const Q = collision
    const _QC2 = Geometry.Point.sub(handle, Q)
    const _QR = Geometry.Point.setLength(_QC2, 40)
    const _perp = Geometry.Point.perp(_QR)

    const angleV = Geometry.Point.getAngle(state.velocity)
    const anglePerp = Geometry.Point.getAngle(_perp)
    const angle = angleV - anglePerp

    const V2 = Geometry.Point.add(state.ball, state.velocity)
    const finalPoint = Geometry.Point.rotateWrt(V2, angle * 2, Q)

    const velocity = Geometry.Point.sub(finalPoint, Q)
    let elasticVelocity = Geometry.Point.scalarMul(1.2, velocity)
    if (fpop.lt(Geometry.Point.getLength(elasticVelocity), 1)) {
      elasticVelocity = Geometry.Point.setLength(elasticVelocity, 1.2)
    }

    return resolveCollisions({
      ...state,
      velocity: elasticVelocity,
    })
  }

  return state
}

function isPassingThrough (state: State): boolean {
  const ballStart = state.ball
  const ballEnd = Geometry.Point.add(ballStart, state.velocity)
  const left = Geometry.Point.add(state.leftHandle, Geometry.Point.New(5, 0))
  const right = Geometry.Point.add(state.rightHandle, Geometry.Point.New(-5, 0))
  const result = Geometry.VectorIntersection.exists(ballStart, ballEnd, left, right)
  return result == Geometry.VectorIntersection.IntersectionType.Point
}

function advance (state: State): State | null {
  const hasReachedPeak = state.velocity.y > 0
  const newState = hasReachedPeak ? resolveCollisions(state) : state
  const hasPassedThrough = state.hasPassedThrough || (hasReachedPeak ? isPassingThrough(state) : false)
  const ball = Geometry.Point.add(newState.ball, newState.velocity)
  const velocity = Geometry.Point.add(newState.velocity, newState.gravity)
  if (ball.x < -20 || ball.x > 120 || ball.y > 180) return null
  return {
    ...newState,
    ball,
    velocity,
    passedTime: newState.passedTime + 1,
    hasReachedPeak,
    hasPassedThrough,
  }
}

function loop (state: State) {
  const newState = advance(state)
  return function () {
    if (newState != null) {
      // if (!state.hasPassedThrough && newState.hasPassedThrough) {
      //   console.log('yes!')
      // }
      updateView(root, newState)
      requestAnimationFrame(loop(newState))
    } else {
      newGame()
      if (!state.hasPassedThrough) {
        score = 0
      } else {
        score++
        flashScore()
      }
    }
  }
}

function randomBetween (min: number, max: number) {
  return (Math.random() * (max - min)) + min
}

let score: number = 0
let state: State

function generateState (): State {
  const ballX = randomBetween(20, 80)
  return {
    ball: Geometry.Point.New(ballX, 140),
    ballR: 8,
    velocity: Geometry.Point.New(0, 0),
    passedTime: 0,
    gravity: Geometry.Point.New(0, .16),
    leftHandle: Geometry.Point.New(33, 68),
    rightHandle: Geometry.Point.New(66, 68),
    handleR: 1,
    hasReachedPeak: false,
    hasPassedThrough: false,
  }
}

function newGame () {
  destroyView(root)
  state = generateState()
  initDraw(root, state)
}

function flashScore () {
  const svg = document.querySelector('svg') as SVGSVGElement
  const text = create('text', [
    ['text-anchor', 'middle'],
    ['dominant-baseline', 'middle'],
    ['y', '13%'],
    ['x', '50%'],
    ['fill', '#aaa'],
  ])
  text.innerHTML = score.toString()
  svg.append(text)
}

const root = document.getElementById('game') as HTMLDivElement
initDraw(root, generateState())

document.addEventListener('click', (event: MouseEvent) => {
  const relativeEl = document.querySelector('#background')!
  const { top, left, width, height } = relativeEl.getBoundingClientRect()
  const clickX = (event.clientX - left) * 100 / width
  const clickY = (event.clientY - top) * 160 / height
  const click = Geometry.Point.New(clickX, clickY)
  fire(click)
})

window.addEventListener('resize', updateSize)
updateSize()

newGame()
