/* eslint-disable react/jsx-props-no-spreading */
import { useDispatch, useSelector } from "react-redux";
import { BulbOutlined } from "@ant-design/icons";

import { selectTorchIsEnabled, setTorchIsEnabled } from "@/redux/device";

import translations from "@/views/wallet/translations";
import Button from "@/atoms/Button";

import { translate } from "@/util/translations";

export default function TorchButton(props) {
  const dispatch = useDispatch();
  const isTorchEnabled = useSelector(selectTorchIsEnabled);

  const handleTorchButton = async () => {
    dispatch(setTorchIsEnabled(!isTorchEnabled));
  };

  return (
    <Button
      icon={BulbOutlined}
      outerLabel={translate(translations.torch)}
      onClick={handleTorchButton}
      inverted={isTorchEnabled}
      {...props}
    />
  );
}
