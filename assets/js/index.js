const SCHEDULE_URL = 'https://pretalx.luga.de/lit-2024/schedule/export/schedule.json'
const STORAGE_KEY_SCHEDULE = 'schedule'
const STORAGE_KEY_SCHEDULE_HASH = 'scheduleHash'

const init = async () => {
	await initScheduleData()
	renderInitialView()
}

const initScheduleData = async () => {
	const schedule = await getTalks()
	processAndPersistSchedule(schedule)
	persistScheduleHash(schedule)
}

const getTalks = async () => {
	try {
		const response = await fetch(SCHEDULE_URL)
		return await response.json()
	} catch (error) {
		console.error(`Could not fetch schedule data due to following error: \n ${error}`)
		return {}
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
	const encoder = new TextEncoder();
	const encodedSchedule = encoder.encode(JSON.stringify(schedule));
	const hashAsArrayBuffer = await window.crypto.subtle.digest('SHA-256', encodedSchedule);
	const uint8ViewOfHash = new Uint8Array(hashAsArrayBuffer)
	const hashAsString = Array.from(uint8ViewOfHash)
	.map((b) => b.toString(16).padStart(2, '0'))
	.join('')
	return hashAsString;
}


const processAndPersistSchedule = (schedule) => {
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
	const minutes  = (parseInt(arr[0] * 60)) + parseInt(arr[1])
	return minutes * 60 * 1000
}

const persistScheduleHash = async (schedule) => {
	const hash = await hashSchedule(schedule)
	window.localStorage.setItem(STORAGE_KEY_SCHEDULE_HASH, hash)
}

const updateSchedule = async () => {
	const scheduleChanged = await hasScheduleChanged(schedule)
	if (scheduleChanged) {
		processAndPersistSchedule(schedule)
		persistScheduleHash(schedule)
	}
}

const renderInitialView = () => {
	let schedule = JSON.parse(window.localStorage.getItem(STORAGE_KEY_SCHEDULE))
	createButtonWithEventListeners('Übersicht', displayRoomSchedule.bind(null, 'Übersicht'))
	for (const room of Object.keys(schedule)) {
		if (schedule.hasOwnProperty(room)) {
			if (room === 'Raum E' || room === 'Raum F') {
				continue
			}
			createButtonWithEventListeners(room, displayRoomSchedule.bind(null, room))
		}
	}
}

const createButtonWithEventListeners = (room, callback) => {
	const button = document.createElement('button')
	button.innerText = room
	button.addEventListener('click', () => {
		callback()
		setInterval(() => {
			updateSchedule()
			callback()
	}, 30000)})
	getRoot().appendChild(button)
}

const getRoot = () => {
	return document.body.querySelector('#root')
}

const displayRoomSchedule = (room) => {
	clearBody()
	const schedule = JSON.parse(window.localStorage.getItem(STORAGE_KEY_SCHEDULE))
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
		return [null, null];
	}

	const now = formatToHoursAndMinutes(new Date('2025-01-16T10:01:00'));

	let currentTalk = null
	currentTalk = roomSchedule.find(talk => {
		const start = formatToHoursAndMinutes(new Date(talk.start));
		const end = formatToHoursAndMinutes(new Date(talk.end));
		return start <= now && now <= end;
	});

	let nextTalk = null
	const currentIndex = roomSchedule.indexOf(currentTalk);
	nextTalk = roomSchedule.find((talk, index) => {
		if (index <= currentIndex) {
			return false;
		}
		const start = formatToHoursAndMinutes(new Date(talk.start));
		return now < start;
	});

	return [currentTalk , nextTalk ];
}

const formatToHoursAndMinutes = (date) => {
	const hours = date.getHours().toString().padStart(2, '0');
	const minutes = date.getMinutes().toString().padStart(2, '0');
  
	return parseInt(hours + minutes);
}

const clearBody = () => {
	const root = document.querySelector('#root')
	while (root.firstChild) {
		root.removeChild(root.lastChild)
	}
}

document.addEventListener('DOMContentLoaded', init)
