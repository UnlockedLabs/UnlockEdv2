const convertSeconds = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = Math.floor(secs % 60);
    if (hours) {
      if (hours == 1) return {number:hours, label:"hour"}
      return {number:hours, label:"hours"}
    } else if (minutes) {
      if (minutes == 1) return {number:minutes, label:"minute"}
      return {number:minutes, label:"minutes"}
    } else {
      if (seconds == 1) return {number:seconds, label:"second"}
      return {number:seconds, label:"seconds"};
    }
};

export default convertSeconds