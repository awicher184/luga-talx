const SCHEDULE_URL = 'https://pretalx.luga.de/lit-2024/schedule/export/schedule.json'
const STORAGE_KEY_SCHEDULE = 'schedule'
const STORAGE_KEY_SCHEDULE_HASH = 'scheduleHash'
const STORAGE_KEY_ROOM = 'room'
const FALLBACK_HEADLINE = 'Linux Info Tag'
const FALLBACK_TEXT = '\\[T]/ Praise The Sun \\[T]/'
const OVERVIEW = 'Übersicht'
const UPDATE_INTERVAL_MILLISECONDS = 5000
const LOOP_INTERVAL_MILLISECONDS = 5000
const FALLBACK_CURRENT_TALK = {"speaker":"","title":"Aktuell laeuft kein Vortrag","subtitle":"","start":"","end":""}
const FALLBACK_NEXT_TALK = {"speaker":"","title":"Heute ist nicht aller Tage Abend. Wir kommen wieder, keine Frage!","subtitle":"","start":"","end":""}
const TIME_DISPLAY_UPDATE_INTERVAL_MS = 60000
const FORMATTER = new Intl.DateTimeFormat('de-DE', {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
	timeZone: 'Europe/Berlin'
})

const NOW = new Date('2024-04-20T08:55:00Z')

const init = async () => {
	await initScheduleData()
	renderInitialView()
	startClock()
}

const initScheduleData = async () => {
	const schedule = await getTalks()
	processAndPersistSchedule(schedule)
	await persistScheduleHash(schedule)
}

const getTalks = async () => {
	try {
		const response = await fetch(SCHEDULE_URL)
		return await response.json()
	} catch (error) {
		console.error(`Could not fetch schedule data due to following error: \n ${error}`)
		return null
	}
}

const validateSchedule = (schedule) => {
	if (!schedule || !schedule.schedule?.conference?.days?.[0]?.rooms) {
		return false
	}
	const rooms = schedule.schedule.conference.days[0].rooms
	return Object.keys(rooms).length > 0
}

const hasScheduleChanged = async (schedule) => {
	if (!schedule) {
		return true
	}

	const scheduleHash = window.localStorage.getItem(STORAGE_KEY_SCHEDULE_HASH)

	if (!scheduleHash) {
		return true
	}

	const newScheduleHash = await hashSchedule(schedule)
	return scheduleHash !== newScheduleHash
}

/**
 * digest returns an ArrayBuffer. To display it as a string all 
 * values have to be converted to hexadecimal strings.
 * For in-depth explanations check:
 * - https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API/Non-cryptographic_uses_of_subtle_crypto
 * - https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest#examples
*/
const hashSchedule = async (schedule) => {
	const encoder = new TextEncoder()
	const encodedSchedule = encoder.encode(JSON.stringify(schedule))
	const hashAsArrayBuffer = await window.crypto.subtle.digest('SHA-256', encodedSchedule)
	const uint8ViewOfHash = new Uint8Array(hashAsArrayBuffer)
	const hashAsString = Array.from(uint8ViewOfHash)
	.map((b) => b.toString(16).padStart(2, '0'))
	.join('')
	return hashAsString
}

const processAndPersistSchedule = (schedule) => {
	if (!schedule) {
		return
	}

	const processedSchedule = {}
	const rooms = schedule?.schedule?.conference?.days[0]?.rooms

	for (const [room, roomSchedule] of Object.entries(rooms)) {
		if (!Object.hasOwn(processedSchedule, room)) {
			processedSchedule[room] = []
		}

		roomSchedule.forEach(talk => {
			const talkStart = new Date(talk.date)
			const talkEnd = new Date(talkStart.getTime() + durationInMilliSeconds(talk.duration))
			const processedTalk = {
				speaker: concatSpeakers(talk.persons),
				title: talk.title,
				subtitle: talk.subtitle,
				start: talkStart,
				end: talkEnd,
			}
			processedSchedule[room].push(processedTalk)
		})
	}

	window.localStorage.setItem(STORAGE_KEY_SCHEDULE, JSON.stringify(processedSchedule))
}

const concatSpeakers = (persons) => {
	let speakers = ''

	for (let i = 0; i < persons.length; i++) {
		if (i > 0 && i < persons?.length) {
			speakers += ', '
		}
		speakers += persons[i].public_name
	}

	return speakers
}

const durationInMilliSeconds = (duration) => {
	const arr = duration.split(':')
	const minutes = (parseInt(arr[0] * 60)) + parseInt(arr[1])
	return minutes * 60 * 1000
}

const persistScheduleHash = async (schedule) => {
	if (!schedule) {
		return
	}

	const hash = await hashSchedule(schedule)
	window.localStorage.setItem(STORAGE_KEY_SCHEDULE_HASH, hash)
}

const updateSchedule = async (schedule) => {
	setInterval(async () => {
		const scheduleChanged = await hasScheduleChanged(schedule)

		if (scheduleChanged) {
			schedule = await getTalks()
			processAndPersistSchedule(schedule)
			persistScheduleHash(schedule)
			const room = window.localStorage.getItem(STORAGE_KEY_ROOM)
			if (!room) {
				return
			}
			room === OVERVIEW ? displayOverview() : displayRoomSchedule(room)
		}
	}, UPDATE_INTERVAL_MILLISECONDS);
}

const renderInitialView = () => {
	let schedule = JSON.parse(window.localStorage.getItem(STORAGE_KEY_SCHEDULE))
	schedule ? renderMainView(schedule) : renderFallBackView()
	updateSchedule(schedule)
}

const renderMainView = (schedule) => {
	clearBody()
	getRoot().appendChild(createButton(OVERVIEW, displayOverview))

	for (const room of Object.keys(schedule)) {
		if (room === 'Raum E' || room === 'Raum F') {
			continue
		}

		let button = createButton(room, displayRoomSchedule.bind(null, room))
		getRoot().appendChild(button)
	}
}

const renderFallBackView = () => {
	clearBody()

	const headline = document.createElement('h3')
	headline.innerText = FALLBACK_HEADLINE

	const paragraph = document.createElement('p')
	paragraph.innerText = FALLBACK_TEXT

	const container = document.createElement('div')
	container.append(headline, paragraph)

	getRoot().appendChild(container)
}

const createButton = (room, callback) => {
	const button = document.createElement('button')
	button.innerText = room
	button.addEventListener('click', callback)
	return button
}

const displayOverview = () => {
	window.localStorage.setItem(STORAGE_KEY_ROOM, OVERVIEW)
	const schedule = JSON.parse(window.localStorage.getItem(STORAGE_KEY_SCHEDULE))

	if (!schedule) {
		renderFallBackView()
		return
	}

	const rooms = Object.keys(schedule)

	const infitelyLoopRooms = (index = 0) => {
		const room = rooms[index]
		displayRoomSchedule(room)
		const nextIndex = (index + 1) % rooms.length
		setTimeout(() => infitelyLoopRooms(nextIndex), LOOP_INTERVAL_MILLISECONDS)
	}

	infitelyLoopRooms()
}

const displayRoomSchedule = (room) => {
	window.localStorage.setItem(STORAGE_KEY_ROOM, room)
	const schedule = JSON.parse(window.localStorage.getItem(STORAGE_KEY_SCHEDULE))

	if (!schedule) {
		renderFallBackView()
		return
	}

	clearBody()

	const header = document.createElement('h1')
	header.innerText = room
	getRoot().appendChild(header)
	const [currentTalk, nextTalk] = getCurrentAndNextTalk(schedule[room])
	
	if (currentTalk) {
		getRoot().appendChild(createCard(currentTalk))
	}

	if (nextTalk) {
		getRoot().appendChild(createCard(nextTalk, false))
	}

	startTimeDisplayUpdates()
}

const createCard = (talk, isCurrent = true) => {
	const cardHeader = document.createElement('h2')
	cardHeader.innerText = isCurrent ? 'Current Talk' : 'Next Talk'

	const talkTitle = document.createElement('h4')
	talkTitle.innerText = talk.title

	const speaker = document.createElement('p')
	speaker.innerText = talk.speaker

	const cardBody = document.createElement('div')
	cardBody.append(cardHeader, talkTitle, speaker)
	
	if (isCurrent && talk.end !== '') {
		const timeElement = document.createElement('p')
		timeElement.id = 'current-time-info'
		const minutesSinceStart = calculateDifferenceInMinutes(NOW, new Date(talk.start))
		timeElement.innerText = `läuft seit: ${minutesSinceStart} Minuten`
		cardBody.appendChild(timeElement)
	}

	if (!isCurrent && talk.start !== '') {
		const timeElement = document.createElement('p')
		timeElement.id = 'next-time-info'
		const startTime = FORMATTER.format(new Date(talk.start))
		const minutesUntilStart = calculateDifferenceInMinutes(NOW, new Date(talk.start))
		timeElement.innerText = `startet um: ${startTime} (in ${minutesUntilStart} Minuten)`
		cardBody.appendChild(timeElement)
	}

	const card = document.createElement('div')
	card.id = isCurrent ? 'current' : 'next'
	card.classList.add('card')
	card.appendChild(cardBody)

	return card
}

const getCurrentAndNextTalk = (roomSchedule) => {
	if (!roomSchedule?.length) {
		return [FALLBACK_CURRENT_TALK, FALLBACK_NEXT_TALK]
	}

	const now = formatToHoursAndMinutes(NOW)

	let currentTalk = roomSchedule.find(talk => {
		const start = formatToHoursAndMinutes(new Date(talk.start))
		const end = formatToHoursAndMinutes(new Date(talk.end))
		return start <= now && now <= end
	})
	currentTalk = currentTalk ?? FALLBACK_CURRENT_TALK

	const currentIndex = roomSchedule.indexOf(currentTalk)
	let nextTalk = roomSchedule.find((talk, index) => {
		if (index <= currentIndex) {
			return false
		}

		const start = formatToHoursAndMinutes(new Date(talk.start))
		return now < start
	})
	nextTalk = nextTalk ?? FALLBACK_NEXT_TALK

	return [currentTalk , nextTalk]
}

const formatToHoursAndMinutes = (date) => {
	const formattedTime = FORMATTER.format(date)
	const [hours, minutes] = formattedTime.split(':')
	return parseInt(hours + minutes)
}

const clearBody = () => {
	const root = getRoot()
	root.innerHTML = ''
}

const getRoot = () => {
	return document.body.querySelector('#root')
}

const calculateDifferenceInMinutes = (start, end) => {
	const differenceInMilliseconds = Math.abs(end - start)
	return Math.floor(differenceInMilliseconds / (1000 * 60))
}

const updateTimeDisplay = () => {
	const currentTimeInfo = document.getElementById('current-time-info')
	const nextTimeInfo = document.getElementById('next-time-info')

	if (currentTimeInfo && currentTimeInfo.startTime) {
		const startTime = new Date(currentTimeInfo.startTime)
		const minutesSinceStart = calculateDifferenceInMinutes(startTime, NOW)
		currentTimeInfo.innerText = `läuft seit: ${minutesSinceStart} Minuten`
	}

	if (nextTimeInfo && nextTimeInfo.startTime) {
		const startTime = new Date(nextTimeInfo.startTime)
		const formattedStartTime = FORMATTER.format(startTime)
		const minutesUntilStart = calculateDifferenceInMinutes(NOW, startTime)
		nextTimeInfo.innerText = `Startet um: ${formattedStartTime} (in ${minutesUntilStart} Minuten)`
	}
}

const startTimeDisplayUpdates = () => {
	updateTimeDisplay()
	setInterval(updateTimeDisplay, TIME_DISPLAY_UPDATE_INTERVAL_MS)
}

const startClock = () => {
	renderClock()
	setInterval(renderClock, 60000)
}

const renderClock = () => {
	const clockElement = document.getElementById('clock')

	const currentTime = new Date()

	clockElement.innerHTML = `${FORMATTER.format(currentTime)}`}

document.addEventListener('DOMContentLoaded', init)
