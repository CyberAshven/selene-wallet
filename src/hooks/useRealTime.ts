import { useEffect, useState } from "react";

const useRealTime = (interval = 100) => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const realtimer = setInterval(() => {
      setNow(new Date());
    }, interval);
    return () => {
      clearInterval(realtimer);
    };
    // eslint-disable-next-line
  }, []);
  return now;
};

export default useRealTime;
