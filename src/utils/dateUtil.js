/**
 * 输出当前时间的格式化日期信息。
 * 
 * @returns {string} 格式化的日期
 */
export function getTime() {
    const currentDate = new Date();

    const month = currentDate.toLocaleString('en-US', { month: 'short' });
    const day = currentDate.getDate();
    const hours = currentDate.getHours();
    const minutes = currentDate.getMinutes();
    const seconds = currentDate.getSeconds();

    return `[${hours < 10 ? '0' : ''}${hours}:` +
        `${minutes < 10 ? '0' : ''}${minutes}:` +
        `${seconds < 10 ? '0' : ''}${seconds}]`;

    // return `[${month},${day < 10 ? '0' : ''}${day}]` +
    //     `[${hours < 10 ? '0' : ''}${hours}:` +
    //     `${minutes < 10 ? '0' : ''}${minutes}:` +
    //     `${seconds < 10 ? '0' : ''}${seconds}]`;
}