// Ui.jsx
// The entire user interface, in one prop-driven component.
//
// Purely presentational on purpose: no store access, no fetches, no effects. Every
// decision about what to show comes in as a prop, which makes the whole UI
// inspectable from a single place and trivially previewable in any state.
// Interface.jsx is the container that wires it to the store.
//
// Layout is a full-screen CSS grid (see .ui in style.css) rather than the pile of
// absolutely-positioned percentages this replaces. The root is pointer-events: none
// so clicks fall through to the canvas; interactive elements opt back in.

import React from 'react'
import SoundIcon from '../icons/SoundIcon'
import { formatTime } from './useScoreSubmission'

const CONTROLS = [
  ['W / Z / ↑', 'Nose down'],
  ['S / ↓', 'Nose up'],
  ['A / Q', 'Roll left'],
  ['D', 'Roll right'],
  ['←', 'Yaw left'],
  ['→', 'Yaw right'],
  ['Shift', 'Boost'],
  ['Esc / P', 'Pause']
]

const CREDITS = [
  <>
    Game created by <a href='https://lennertvg.be'>Lennert Van Geert</a>
  </>,
  <>
    "Low poly rabbit" by Tin3D, licensed under{' '}
    <a href='http://creativecommons.org/licenses/by/4.0/'>CC Attribution</a>.
  </>,
  <>
    "Explorer Goggles" by Anthony.Do, licensed under{' '}
    <a href='http://creativecommons.org/licenses/by/4.0/'>CC Attribution</a>.
  </>,
  <>
    "Smoke" by Guillermo T, licensed under{' '}
    <a href='http://creativecommons.org/licenses/by/4.0/'>CC Attribution</a>.
  </>,
  <>
    Song: Dosi &amp; Aisake — Cruising [NCS Release], provided by{' '}
    <a href='http://ncs.io/Cruising'>NoCopyrightSounds</a>.
  </>,
  <>
    Sound effects by{' '}
    <a href='https://pixabay.com/users/freesound_community-46691455/'>
      freesound_community
    </a>{' '}
    and{' '}
    <a href='https://pixabay.com/users/blendertimer-9538909/'>Daniel Roberts</a>{' '}
    from <a href='https://pixabay.com/'>Pixabay</a>.
  </>
]

const Button = ({ onClick, children, variant = '' }) => (
  <button
    type='button'
    className={`btn ${variant ? `btn--${variant}` : ''}`}
    onClick={onClick}
  >
    {children}
  </button>
)

const Toggle = ({ label, checked, onChange }) => (
  <label className='toggle'>
    <span className='toggle__label'>{label}</span>
    <input
      type='checkbox'
      className='toggle__input'
      checked={checked}
      onChange={onChange}
    />
  </label>
)

/** Right-hand panel. Holds leaderboard / controls / credits content. */
const Panel = ({ title, children }) => (
  <aside className='panel'>
    {title && <h2 className='panel__title'>{title}</h2>}
    <div className='panel__body'>{children}</div>
  </aside>
)

/** Centred modal over a scrim. Used by pause, crash and finish. */
const Modal = ({ title, children }) => (
  <div className='modal'>
    <div className='modal__scrim' />
    <div className='modal__card'>
      {title && <h1 className='modal__title'>{title}</h1>}
      {children}
    </div>
  </div>
)

const Leaderboard = ({ status, entries }) => {
  if (status === 'loading') return <p className='panel__note'>Loading…</p>
  if (status === 'error')
    return <p className='panel__note'>Couldn't load the leaderboard.</p>
  if (entries.length === 0)
    return <p className='panel__note'>No scores yet — go set one.</p>

  return (
    <ol className='board'>
      {entries.map((entry, i) => (
        <li className='board__row' key={entry.id}>
          <span className='board__rank'>{i + 1}</span>
          <span className='board__name'>{entry.userName}</span>
          {/* Firestore stores the raw integer ms; formatting happens here. */}
          <span className='board__score'>{formatTime(entry.timeMs)}</span>
        </li>
      ))}
    </ol>
  )
}

const Ui = ({
  phase,
  menuPhase,
  paused,
  isLoadingRun,
  userName,
  score,
  ringCount,
  playTime,
  flewOutOfMap,
  outOfBounds,
  isMusicOn,
  isSfxOn,
  effectsOn,
  beaconsOn,
  leaderboard,
  submission,
  hudRefs,
  on
}) => {
  const isMenu = phase === 'ready'
  const isPlaying = phase === 'playing'

  return (
    <main className='ui'>
      {/* Sound toggle is the only thing present in every phase, including
          "crashing" — which otherwise renders nothing at all, deliberately, so the
          ejection sequence plays uninterrupted. */}
      <div className={`ui__sound ${isMenu ? 'ui__sound--menu' : ''}`}>
        <button
          type='button'
          className='icon_button'
          onClick={on.toggleMusic}
          aria-label={isMusicOn ? 'Mute music' : 'Unmute music'}
        >
          <SoundIcon on={isMusicOn} />
        </button>
      </div>

      {/* ---------------------------------------------------------------- menu */}
      {isMenu && (
        <div className='ui__lower'>
          <h1 className='brand'>Whisker Wings</h1>

          {menuPhase === 'main' && (
            <>
              <label className='field'>
                <span className='field__label'>Username</span>
                <input
                  type='text'
                  className='field__input'
                  placeholder='Enter your name'
                  value={userName}
                  onChange={e => on.changeUserName(e.target.value)}
                />
              </label>
              <nav className='nav'>
                <Button variant='primary' onClick={on.start}>
                  Start
                </Button>
                <Button onClick={() => on.navigate('leaderboards')}>
                  Leaderboard
                </Button>
                <Button onClick={() => on.navigate('settings')}>
                  Settings
                </Button>
              </nav>
            </>
          )}

          {menuPhase === 'settings' && (
            <>
              <div className='settings'>
                <Toggle
                  label='Ring beacons'
                  checked={beaconsOn}
                  onChange={on.toggleBeacons}
                />
                <Toggle
                  label='Sound effects'
                  checked={isSfxOn}
                  onChange={on.toggleSfx}
                />
                <Toggle
                  label='Visual effects'
                  checked={effectsOn}
                  onChange={on.toggleEffects}
                />
              </div>
              <nav className='nav'>
                <Button onClick={() => on.navigate('main')}>Back</Button>
                <Button onClick={() => on.navigate('controls')}>
                  Controls
                </Button>
                <Button onClick={() => on.navigate('credits')}>Credits</Button>
              </nav>
            </>
          )}

          {menuPhase !== 'main' && menuPhase !== 'settings' && (
            <nav className='nav'>
              <Button onClick={() => on.navigate('settings')}>Back</Button>
            </nav>
          )}
        </div>
      )}

      {/* Right-hand panel. The menu plane tweens screen-left for these pages
          (MenuPlane.jsx), so the panel and the plane don't fight for space. */}
      {isMenu && menuPhase === 'leaderboards' && (
        <Panel title='Leaderboard'>
          <Leaderboard {...leaderboard} />
        </Panel>
      )}

      {isMenu && menuPhase === 'controls' && (
        <Panel title='Controls'>
          <ul className='keys'>
            {CONTROLS.map(([key, action]) => (
              <li className='keys__row' key={key}>
                <kbd className='keys__key'>{key}</kbd>
                <span className='keys__action'>{action}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {isMenu && menuPhase === 'credits' && (
        <Panel title='Credits'>
          <ul className='credits'>
            {CREDITS.map((entry, i) => (
              <li className='credits__item' key={i}>
                {entry}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* ----------------------------------------------------------------- hud */}
      {isPlaying && (
        <>
          <div className='hud hud--top-left'>
            <span className='hud__label'>Rings</span>
            <span className='hud__value'>
              {score}/{ringCount}
            </span>
          </div>

          <div className='hud hud--top-right'>
            <span className='hud__label'>Time</span>
            {/* Written every frame from the r3f loop, never by React. */}
            <span className='hud__value hud__value--num' ref={hudRefs.time}>
              0.00
            </span>
          </div>

          <div className='hud hud--bottom-left'>
            <div className='stall' ref={hudRefs.stallWarning}>
              Stall
            </div>
            <div className='airspeed'>
              <span
                className='hud__value hud__value--num'
                ref={hudRefs.airspeed}
              >
                25
              </span>
              <span className='airspeed__unit'>kn</span>
            </div>
          </div>

          {outOfBounds && (
            <div className='warning'>
              <span className='warning__text'>⚠ Turn back</span>
              <span
                className='warning__countdown'
                ref={hudRefs.boundsCountdown}
              >
                3.0
              </span>
            </div>
          )}

          {paused && (
            <Modal title='Paused'>
              <div className='modal__actions'>
                <Button variant='primary' onClick={on.resume}>
                  Resume
                </Button>
                <Button onClick={on.restart}>Restart</Button>
                <Button onClick={on.mainMenu}>Main menu</Button>
              </div>
            </Modal>
          )}

          {isLoadingRun && (
            <div className='loading'>
              <span className='loading__text'>Loading map…</span>
            </div>
          )}
        </>
      )}

      {/* --------------------------------------------------------- end screens */}
      {phase === 'failed' && (
        <Modal title={flewOutOfMap ? 'Try staying in the map' : 'You crashed'}>
          <div className='modal__actions'>
            <Button variant='primary' onClick={on.restart}>
              Try again
            </Button>
            <Button onClick={on.mainMenu}>Main menu</Button>
          </div>
        </Modal>
      )}

      {phase === 'ended' && (
        <Modal title='Finish'>
          {/* From the store, never scraped out of the HUD's DOM node — that node
              only exists while playing, and reading it after the fact used to
              crash the whole interface. */}
          <p className='modal__stat'>{formatTime(playTime)}</p>
          <p className='modal__caption'>seconds</p>

          {submission === 'saving' && (
            <p className='modal__note'>Saving score…</p>
          )}
          {submission === 'failed' && (
            <p className='modal__note modal__note--error'>
              Couldn't save your score
            </p>
          )}

          <div className='modal__actions'>
            <Button variant='primary' onClick={on.restart}>
              Try again
            </Button>
            <Button onClick={on.mainMenu}>Main menu</Button>
          </div>
        </Modal>
      )}
    </main>
  )
}

export default Ui
