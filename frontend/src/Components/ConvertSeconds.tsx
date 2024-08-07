const convertSeconds = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);

    return hours
        ? { number: hours, label: `hr${hours === 1 ? '' : 's'}` }
        : minutes
          ? { number: minutes, label: `min${minutes === 1 ? '' : 's'}` }
          : { number: seconds, label: `sec${seconds === 1 ? '' : 's'}` };
};

export default convertSeconds;
