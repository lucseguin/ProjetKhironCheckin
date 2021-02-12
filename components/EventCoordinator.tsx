
import React from 'react';

export type EventCoordinatorEvent = {
	channel: string;
	payload: EventCoordinatorPayload;
};

export type EventCoordinatorPayload = {
	type: string;
	data?: any;
	message?: string;
	errorMessage?: string;
};

export type EventCoordinatorCallback = (event: EventCoordinatorEvent) => void;

export class EventCoordinatorClass {
	private listeners: EventCoordinatorCallback[] = [];

	supportedChannel = [
		'auth',
		'notif',
	];

	constructor() {
	}

	remove(channel: string, listener: EventCoordinatorCallback) {
        const holder = this.listeners[channel];
        if (holder) {
            this.listeners[channel] = [
                ...holder.filter((callback) => callback !== listener),
            ];
        }
	}

	signal(
		channel: string,
		payload: EventCoordinatorPayload,
	) {
		const event: EventCoordinatorEvent = {
			channel,
			payload: { ...payload },
		};

		try {
			this.broadcast(event);
		} catch (e) {
			console.log("Failed to broadcast message. " + e.message);
		}
	}

	register(
		channel: string,
		callback?: EventCoordinatorCallback
	) {	
        let bin = this.listeners[channel];

        if (!bin) {
            bin = [];
            this.listeners[channel] = bin;
        }

        bin.push({
            callback: callback,
        });

		return () => {
			this.remove(channel, callback);
		};
	}

	private broadcast(event: EventCoordinatorEvent) {
		const { channel, payload } = event;
		const bin = this.listeners[channel];

		if (bin) {
			//console.log(`Broadcasting to ${channel} with `, payload);
			bin.forEach(listener => {
				try {
					listener.callback(event);
				} catch (e) {
					console.log("Failed to invoke callback." + e.message);
				}
			});
		}
	}
}

export const EventCoordinator = new EventCoordinatorClass();

export default EventCoordinator;