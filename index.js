'use strict'

const getTalks = async () => {
	let schedule = {}
	try {
		const response = await fetch('https://pretalx.luga.de/lit-2024/schedule/export/schedule.json')
		schedule = await response.json()
	} catch (error) {
		console.error(`Could not fetch schedule data due to following error: \n ${error}`)
		return {}
	}

	return schedule
}

const validateTalks = (schedule) => {
	if (!schedule) {
		return false
	}

	if (
		!Object.hasOwn(schedule, "schedule") &&
		schedule.schedule === null &&
		schedule.schedule === undefined
	) {
		return false
	}

	if (
		!Object.hasOwn(schedule.schedule, "conference") &&
		schedule.schedule.conference === null &&
		schedule.schedule.conference === undefined
	) {
		return false
	}

	if (
		!Object.hasOwn(schedule.schedule.conference, "days") &&
		schedule.schedule.conference.days === null &&
		schedule.schedule.conference.days === undefined
	) {
		return false
	}

	if (
		!Object.hasOwn(schedule.schedule.conference.days, "0") &&
		schedule.schedule.conference.days[0] === null &&
		schedule.schedule.conference.days[0] === undefined &&
		schedule.schedule.conference.days[0].length === 0
	) {
		return false
	}
	
	if (
		!Object.hasOwn(schedule.schedule.conference.days[0], "rooms") &&
		schedule.schedule.conference.days[0] === null &&
		schedule.schedule.conference.days[0] === undefined
	) {
		return false
	}

	return true
}


const durationInMilliSeconds = (duration) => {
	const arr = duration.split(":")
	const minutes  = (parseInt(arr[0] * 60)) + parseInt(arr[1])
	return minutes * 60 * 1000
}

(async () => {
	const schedule = await getTalks()
	const isValid = validateTalks(schedule)
})()
