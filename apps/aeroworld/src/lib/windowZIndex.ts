let topWindowZIndex = 345;

export const getNextWindowZIndex = () => {
  topWindowZIndex += 1;
  return topWindowZIndex;
};
