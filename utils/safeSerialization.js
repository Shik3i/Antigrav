function toSerializableValue(value) {
    if (typeof value === 'bigint') {
        const numeric = Number(value);
        return Number.isSafeInteger(numeric) ? numeric : value.toString();
    }

    if (Array.isArray(value)) {
        return value.map(toSerializableValue);
    }

    if (value && typeof value === 'object') {
        const result = {};
        Object.entries(value).forEach(([key, nestedValue]) => {
            result[key] = toSerializableValue(nestedValue);
        });
        return result;
    }

    return value;
}

function safeStringify(value, replacer, space) {
    return JSON.stringify(toSerializableValue(value), replacer, space);
}

function safeJson(res, payload) {
    return res.json(toSerializableValue(payload));
}

function safeEmit(target, event, payload) {
    target.emit(event, toSerializableValue(payload));
}

module.exports = {
    toSerializableValue,
    safeStringify,
    safeJson,
    safeEmit
};
