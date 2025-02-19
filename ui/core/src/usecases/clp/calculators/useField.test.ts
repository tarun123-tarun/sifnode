import { ref, Ref } from "@vue/reactivity";
import { Asset, IAssetAmount, Network } from "../../../entities";
import { getTestingToken } from "../../../test/utils/getTestingToken";
import { useField } from "./useField";

// TODO eventually delete me as this is an implementation detail
describe("useField", () => {
  let amount: Ref<string>;
  let symbol: Ref<string | null>;

  let asset: Ref<Asset | null>;
  let fieldAmount: Ref<IAssetAmount | null>;

  getTestingToken("ATK");

  beforeEach(() => {
    amount = ref("0");
    symbol = ref<string | null>(null);
    ({ asset, fieldAmount } = useField(amount, symbol));
  });

  it("should reflect correct values", () => {
    symbol.value = "atk";
    amount.value = "12";

    expect(asset.value?.symbol).toBe("atk");
    expect(fieldAmount.value?.toBigInt().toString()).toBe(
      "12000000000000000000",
    );
    amount.value = "123.123123";
    expect(fieldAmount.value?.toBigInt().toString()).toBe(
      "123123123000000000000",
    );
  });
});
