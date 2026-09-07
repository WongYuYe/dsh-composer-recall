window.__ModuleLoader__.load({
	id: 'dsh-composer-recall',
	factory: (require) => {
		const module = { exports: {} }
		const exports = module.exports
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

		const name = 'dsh-composer-recall'
		const inject = ['conversation', 'sessions']

		const COMPOSER_SEL = '[data-composer-input]'
		const SCROLL_SEL = '[data-input-scroll]'
		const USER_SEL = '[data-chat-flow-kind="user"]'

		/**
		 * The Lexical composer surface behind an event target, or undefined when
		 * the target is not the composer (`[data-composer-input]` inside
		 * `[data-input-scroll]`).
		 */
		function composerOf(target) {
			if (!(target instanceof HTMLElement)) return undefined
			const editable = target.closest(COMPOSER_SEL)
			if (editable instanceof HTMLElement && editable.closest(SCROLL_SEL) !== null) return editable
			return undefined
		}

		/** The per-session input shell (SessionInputShell face), or undefined. */
		function currentShell(ctx) {
			try {
				const sessions = ctx.get('sessions')
				const conversation = ctx.get('conversation')
				const id = sessions?.list?.getSnapshot?.()?.current
				if (id === undefined) return undefined
				const actx = sessions.scope(id)
				if (actx === undefined) return undefined
				return conversation.input.for(actx)
			} catch {
				return undefined
			}
		}

		/** Authoritative plain-text draft of the current composer. */
		function currentDraft(shell) {
			try {
				return shell.state.getSnapshot().draft ?? ''
			} catch {
				return ''
			}
		}

		/** Replace the whole draft via the official input shell (editor.update). */
		function setDraft(shell, text) {
			if (shell === undefined) return
			try {
				shell.setDraft(text)
			} catch {}
		}

		/**
		 * Submitted user prompts for the current session, oldest first, read from
		 * rendered chat rows. Each `[data-chat-flow-kind="user"]` row carries its
		 * text in a `.bubble` element (the row also contains a timestamp / copy
		 * action, so the bubble is the reliable text face).
		 */
		function userHistory() {
			const out = []
			try {
				for (const row of document.querySelectorAll(USER_SEL)) {
					const bubble = row.querySelector('[class*="bubble"]')
					const text = (bubble !== null ? bubble.textContent : row.textContent) ?? ''
					const t = text.replace(/\u00a0/g, ' ').trim()
					if (t !== '') out.push(t)
				}
			} catch {}
			return out
		}

		/** Collapsed caret offset into the contenteditable composer text. */
		function caretOffset(composer) {
			try {
				const sel = document.getSelection()
				if (sel === null || sel.rangeCount === 0) return 0
				const range = sel.getRangeAt(0)
				if (!range.collapsed) return -1
				const container = range.startContainer
				if (container !== composer && !composer.contains(container)) return -1
				const pre = range.cloneRange()
				pre.selectNodeContents(composer)
				pre.setEnd(container, range.startOffset)
				return pre.toString().length
			} catch {
				return 0
			}
		}

		function apply(ctx) {
			let cursor = -1
			let hist = []
			let draftStash = ''
			let composing = false

			const onCompositionStart = () => {
				composing = true
			}
			const onCompositionEnd = () => {
				composing = false
			}

			const onKeyDown = (e) => {
				if (e.key === 'Escape') {
					if (composerOf(e.target) === undefined) return
					if (cursor === -1) return
					cursor = -1
					setDraft(currentShell(ctx), draftStash)
					return
				}

				if (composing || e.isComposing) return
				if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
				if (e.ctrlKey || e.metaKey || e.altKey) return

				const composer = composerOf(e.target)
				if (composer === undefined) return
				if (document.activeElement !== composer) return

				const shell = currentShell(ctx)
				if (shell === undefined) return

				const draft = currentDraft(shell)

				if (e.key === 'ArrowUp') {
					if (cursor === -1) {
						const caret = caretOffset(composer)
						if (draft !== '' && caret !== 0) return
						const next = userHistory()
						if (next.length === 0) return
						hist = next
						draftStash = draft
						cursor = hist.length - 1
						e.preventDefault()
						e.stopPropagation()
						setDraft(shell, hist[cursor])
					} else {
						e.preventDefault()
						e.stopPropagation()
						if (cursor > 0) {
							cursor -= 1
							setDraft(shell, hist[cursor])
						}
					}
					return
				}

				if (cursor === -1) return
				e.preventDefault()
				e.stopPropagation()
				if (cursor < hist.length - 1) {
					cursor += 1
					setDraft(shell, hist[cursor])
				} else {
					cursor = -1
					setDraft(shell, draftStash)
				}
			}

			const onInput = (e) => {
				if (cursor !== -1 && composerOf(e.target) !== undefined && e.isTrusted) cursor = -1
			}

			document.addEventListener('compositionstart', onCompositionStart, true)
			document.addEventListener('compositionend', onCompositionEnd, true)
			document.addEventListener('keydown', onKeyDown, true)
			document.addEventListener('input', onInput, true)

			ctx.effect(() => () => {
				document.removeEventListener('compositionstart', onCompositionStart, true)
				document.removeEventListener('compositionend', onCompositionEnd, true)
				document.removeEventListener('keydown', onKeyDown, true)
				document.removeEventListener('input', onInput, true)
			}, 'dsh-composer-recall: history')
		}

		exports.name = name
		exports.inject = inject
		exports.apply = apply
		return module.exports
	},
})
