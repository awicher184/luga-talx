const SCHEDULE_URL = 'https://pretalx.luga.de/lit-2024/schedule/export/schedule.json'
const STORAGE_KEY_SCHEDULE = 'schedule'
const STORAGE_KEY_SCHEDULE_HASH = 'scheduleHash'
const STORAGE_KEY_ROOM = 'room'
const FALLBACK_HEADLINE = 'Linux Info Tag'
const FALLBACK_TEXT = '\\[T]/ Praise The Sun \\[T]/'
const OVERVIEW = 'Übersicht'
const UPDATE_INTERVAL_MILLISECONDS = 5000
const LOOP_INTERVAL_MILLISECONDS = 5000

const init = async () => {
	await initScheduleData()
	renderInitialView()
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
	if (!schedule) {
		return false
	}

	if (
		!Object.hasOwn(schedule, 'schedule') &&
		schedule.schedule === null &&
		schedule.schedule === undefined
	) {
		return false
	}

	if (
		!Object.hasOwn(schedule.schedule, 'conference') &&
		schedule.schedule.conference === null &&
		schedule.schedule.conference === undefined
	) {
		return false
	}
	
	if (
		!Object.hasOwn(schedule.schedule.conference, 'days') &&
		schedule.schedule.conference.days === null &&
		schedule.schedule.conference.days === undefined
	) {
		return false
	}

	if (
		!Object.hasOwn(schedule.schedule.conference.days, '0') &&
		schedule.schedule.conference.days[0] === null &&
		schedule.schedule.conference.days[0] === undefined &&
		schedule.schedule.conference.days[0].length === 0
	) {
		return false
	}

	if (
		!Object.hasOwn(schedule.schedule.conference.days[0], 'rooms') &&
		schedule.schedule.conference.days[0] === null &&
		schedule.schedule.conference.days[0] === undefined
	) {
		return false
	}

	return true
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
		console.log('praise')
		const scheduleChanged = await hasScheduleChanged(schedule)

		if (scheduleChanged) {
		console.log('updated')
			schedule = await getTalks()
			processAndPersistSchedule(schedule)
			persistScheduleHash(schedule)
			const room = window.localStorage.getItem(STORAGE_KEY_ROOM)
			room === OVERVIEW || room === 'null' ? displayOverview() : displayRoomSchedule(room)
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
	}

	clearBody()

	const [currentTalk, nextTalk] = getCurrentAndNextTalk(schedule[room])
	
	if (currentTalk) {
		getRoot().appendChild(createCard(currentTalk))
	}

	if (nextTalk) {
		getRoot().appendChild(createCard(nextTalk, false))
	}
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
	
	const card = document.createElement('div')
	card.id = isCurrent ? 'current' : 'next'
	card.classList.add('card')
	card.appendChild(cardBody)

	return card
}

const getCurrentAndNextTalk = (roomSchedule) => {
	if (!roomSchedule?.length) {
		return [null, null]
	}

	const now = formatToHoursAndMinutes(new Date('2025-01-16T08:51:00'))

	let currentTalk = null
	currentTalk = roomSchedule.find(talk => {
		const start = formatToHoursAndMinutes(new Date(talk.start))
		const end = formatToHoursAndMinutes(new Date(talk.end))
		return start <= now && now <= end
	})

	let nextTalk = null
	const currentIndex = roomSchedule.indexOf(currentTalk)
	nextTalk = roomSchedule.find((talk, index) => {
		if (index <= currentIndex) {
			return false
		}

		const start = formatToHoursAndMinutes(new Date(talk.start))
		return now < start
	})

	return [currentTalk , nextTalk]
}

const formatToHoursAndMinutes = (date) => {
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	return parseInt(hours + minutes)
}

const clearBody = () => {
	const root = document.querySelector('#root')

	while (root.firstChild) {
		root.removeChild(root.lastChild)
	}
}

const getRoot = () => {
	return document.body.querySelector('#root')
}

document.addEventListener('DOMContentLoaded', init)
