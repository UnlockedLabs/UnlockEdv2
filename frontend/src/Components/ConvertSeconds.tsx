const convertSeconds = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    //removed seconds per #601 along with not using abbreviations
    return hours
        ? { number: hours, label: `hour${hours === 1 ? '' : 's'}` }
        : { number: minutes, label: `minute${minutes === 1 ? '' : 's'}` };
};

export default convertSeconds;
