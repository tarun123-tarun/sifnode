<script lang="ts">
import { defineComponent, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import Layout from "@/components/layout/Layout.vue";
import CurrencyPairPanel from "@/components/currencyPairPanel/Index.vue";
import { useWalletButton } from "@/components/wallet/useWalletButton";
import SelectTokenDialogSif from "@/components/tokenSelector/SelectTokenDialogSif.vue";
import Modal from "@/components/shared/Modal.vue";
import { Amount, PoolState, usePoolCalculator } from "ui-core";
import { useCore } from "@/hooks/useCore";

import { slipAdjustment } from "../../../core/src/entities/formulae";
import { useWallet } from "@/hooks/useWallet";
import { computed } from "@vue/reactivity";
import FatInfoTable from "@/components/shared/FatInfoTable.vue";
import Checkbox from "@/components/shared/Checkbox.vue";
import FatInfoTableCell from "@/components/shared/FatInfoTableCell.vue";
import ActionsPanel from "@/components/actionsPanel/ActionsPanel.vue";
import { useCurrencyFieldState } from "@/hooks/useCurrencyFieldState";
import { toConfirmState } from "./utils/toConfirmState";
import { getMaxAmount } from "./utils/getMaxAmount";
import { ConfirmState } from "@/types";
import ConfirmationModal from "@/components/shared/ConfirmationModal.vue";
import DetailsPanelPool from "@/components/shared/DetailsPanelPool.vue";
import { formatNumber } from "@/components/shared/utils";
import Tooltip from "@/components/shared/Tooltip.vue";
import Icon from "@/components/shared/Icon.vue";
import { format } from "ui-core/src/utils/format";

export default defineComponent({
  components: {
    ActionsPanel,
    Layout,
    Modal,
    CurrencyPairPanel,
    SelectTokenDialogSif,
    ConfirmationModal,
    DetailsPanelPool,
    FatInfoTable,
    FatInfoTableCell,
    Tooltip,
    Icon,
  },
  props: ["title"],
  setup() {
    const { usecases, poolFinder, store } = useCore();
    const selectedField = ref<"from" | "to" | null>(null);
    const lastFocusedTokenField = ref<"A" | "B" | null>(null);

    const transactionState = ref<ConfirmState | string>("selecting");
    const transactionStateMsg = ref<string>("");
    const transactionHash = ref<string | null>(null);
    let asyncPooling = ref<boolean>(true);
    const router = useRouter();
    const route = useRoute();

    const {
      fromSymbol,
      fromAmount,
      toAmount,
      toSymbol,
    } = useCurrencyFieldState({
      pooling: ref(true),
    });
    const isFromMaxActive = computed(() => {
      const accountBalance = balances.value.find(
        (balance) => balance.asset.symbol === fromSymbol.value,
      );
      if (!accountBalance) return;
      return (
        fromAmount.value === format(accountBalance.amount, accountBalance.asset)
      );
    });

    const isToMaxActive = computed(() => {
      const accountBalance = balances.value.find(
        (balance) => balance.asset.symbol === toSymbol.value,
      );
      if (!accountBalance) return;
      return (
        toAmount.value === format(accountBalance.amount, accountBalance.asset)
      );
    });

    fromSymbol.value = route.params.externalAsset
      ? route.params.externalAsset.toString()
      : null;

    function clearAmounts() {
      fromAmount.value = "0.0";
      toAmount.value = "0.0";
    }

    const { connected } = useWalletButton();

    const { balances } = useWallet(store);
    const liquidityProvider = computed(() => {
      if (
        !fromSymbol.value ||
        !store.wallet.sif.address ||
        !store.accountpools[store.wallet.sif.address] ||
        !store.accountpools[store.wallet.sif.address][
          `${fromSymbol.value}_rowan`
        ]
      )
        return null;

      return (
        store.accountpools[store.wallet.sif.address][
          `${fromSymbol.value}_rowan`
        ].lp || null
      );
    });

    const riskFactor = computed(() => {
      const rFactor = Amount("1");
      if (
        !tokenAFieldAmount.value ||
        !tokenBFieldAmount.value ||
        !poolAmounts.value
      ) {
        return rFactor;
      }
      const nativeBalance = poolAmounts?.value[0];
      const externalBalance = poolAmounts?.value[1];
      const slipAdjustmentCalc = slipAdjustment(
        tokenBFieldAmount.value,
        tokenAFieldAmount.value,
        nativeBalance,
        externalBalance,
        Amount(totalPoolUnits.value),
      );
      return rFactor.subtract(slipAdjustmentCalc);
    });

    const {
      aPerBRatioMessage,
      bPerARatioMessage,
      aPerBRatioProjectedMessage,
      bPerARatioProjectedMessage,
      shareOfPoolPercent,
      totalLiquidityProviderUnits,
      totalPoolUnits,
      poolAmounts,
      tokenAFieldAmount,
      tokenBFieldAmount,
      preExistingPool,
      state,
    } = usePoolCalculator({
      balances,
      tokenAAmount: fromAmount,
      tokenBAmount: toAmount,
      tokenASymbol: fromSymbol,
      tokenBSymbol: toSymbol,
      poolFinder,
      liquidityProvider,
      asyncPooling,
      lastFocusedTokenField,
    });

    function handleNextStepClicked() {
      if (!tokenAFieldAmount.value)
        throw new Error("from field amount is not defined");
      if (!tokenBFieldAmount.value)
        throw new Error("to field amount is not defined");

      transactionState.value = "confirming";
    }

    async function handleAskConfirmClicked() {
      if (!tokenAFieldAmount.value)
        throw new Error("Token A field amount is not defined");
      if (!tokenBFieldAmount.value)
        throw new Error("Token B field amount is not defined");
      transactionState.value = "signing";
      const tx = await usecases.clp.addLiquidity(
        tokenBFieldAmount.value,
        tokenAFieldAmount.value,
      );
      transactionHash.value = tx.hash;
      transactionState.value = toConfirmState(tx.state); // TODO: align states
      transactionStateMsg.value = tx.memo ?? "";
    }

    function requestTransactionModalClose() {
      if (transactionState.value === "confirmed") {
        router.push("/pool");
        clearAmounts();
      } else {
        transactionState.value = "selecting";
      }
    }

    function toggleAsyncPooling() {
      asyncPooling.value = !asyncPooling.value;
    }

    return {
      fromAmount,
      fromSymbol,
      toAmount,
      toSymbol,
      isToMaxActive,
      isFromMaxActive,
      connected,
      aPerBRatioMessage,
      bPerARatioMessage,
      aPerBRatioProjectedMessage,
      bPerARatioProjectedMessage,
      nextStepMessage: computed(() => {
        switch (state.value) {
          case PoolState.SELECT_TOKENS:
            return "Select Tokens";
          case PoolState.ZERO_AMOUNTS:
            return "Please enter an amount";
          case PoolState.ZERO_AMOUNTS_NEW_POOL:
            return "Both inputs required";
          case PoolState.INSUFFICIENT_FUNDS:
            return "Insufficient Funds";
          case PoolState.VALID_INPUT:
            return preExistingPool.value ? "Add liquidity" : "Create Pool";
        }
      }),
      toggleLabel: computed(() => {
        return !preExistingPool.value ? null : "Pool Equally";
      }),
      nextStepAllowed: computed(() => {
        return state.value === PoolState.VALID_INPUT;
      }),
      handleFromSymbolClicked(next: () => void) {
        selectedField.value = "from";
        next();
      },
      handleToSymbolClicked(next: () => void) {
        selectedField.value = "to";
        next();
      },

      handleSelectClosed(data: string) {
        if (typeof data !== "string") {
          return;
        }

        if (selectedField.value === "from") {
          fromSymbol.value = data;
        }

        if (selectedField.value === "to") {
          toSymbol.value = data;
        }
        selectedField.value = null;
      },

      // TODO - The other selectedField variable does a few things
      // And trying to remove the idea of to/from so slightly reinventing here
      handleTokenAFocused() {
        selectedField.value = "from";
        lastFocusedTokenField.value = "A";
      },
      handleTokenBFocused() {
        selectedField.value = "to";
        lastFocusedTokenField.value = "B";
      },
      backlink: window.history.state.back || "/pool",

      handleNextStepClicked,

      handleAskConfirmClicked,

      transactionHash,

      requestTransactionModalClose,

      transactionState,
      transactionStateMsg,
      toggleAsyncPooling,
      asyncPooling,
      handleBlur() {
        selectedField.value = null;
      },
      handleFromMaxClicked() {
        selectedField.value = "from";
        lastFocusedTokenField.value = "A";
        const accountBalance = balances.value.find(
          (balance) => balance.asset.symbol === fromSymbol.value,
        );

        if (!accountBalance) return;
        fromAmount.value = format(accountBalance.amount, accountBalance.asset);
      },
      handleToMaxClicked() {
        selectedField.value = "to";
        lastFocusedTokenField.value = "B";
        const accountBalance = balances.value.find(
          (balance) => balance.asset.symbol === toSymbol.value,
        );
        if (!accountBalance) return;
        const maxAmount = getMaxAmount(toSymbol, accountBalance);
        toAmount.value = format(maxAmount, accountBalance.asset, {
          mantissa: 18,
        });
      },
      shareOfPoolPercent,
      formatNumber,
      poolUnits: totalLiquidityProviderUnits,
      riskFactorStatus: computed(() => {
        if (!riskFactor.value) return "";

        let status = "danger";

        if (asyncPooling.value) {
          return "";
        }
        if (riskFactor.value.lessThanOrEqual("0.2")) {
          status = "warning";
        } else if (riskFactor.value.lessThanOrEqual("0.1")) {
          status = "bad";
        } else if (riskFactor.value.lessThanOrEqual("0.01")) {
          status = "";
        }
        return status;
      }),
    };
  },
});
</script>

<template>
  <Layout class="pool" :backLink="backlink" :title="title">
    <Modal @close="handleSelectClosed">
      <template v-slot:activator="{ requestOpen }">
        <CurrencyPairPanel
          v-model:fromAmount="fromAmount"
          v-model:fromSymbol="fromSymbol"
          @fromfocus="handleTokenAFocused"
          @fromblur="handleBlur"
          @fromsymbolclicked="handleFromSymbolClicked(requestOpen)"
          :fromSymbolSelectable="connected"
          :fromMax="true"
          @frommaxclicked="handleFromMaxClicked"
          :isFromMaxActive="isFromMaxActive"
          v-model:toAmount="toAmount"
          v-model:toSymbol="toSymbol"
          @tofocus="handleTokenBFocused"
          @toblur="handleBlur"
          :toMax="true"
          @tomaxclicked="handleToMaxClicked"
          :isToMaxActive="isToMaxActive"
          toSymbolFixed
          canSwapIcon="plus"
          :toggleLabel="toggleLabel"
          :asyncPooling="asyncPooling"
          @toggleAsyncPooling="toggleAsyncPooling"
      /></template>
      <template v-slot:default="{ requestClose }">
        <SelectTokenDialogSif
          :forceShowAllATokens="true"
          :selectedTokens="[fromSymbol, toSymbol].filter(Boolean)"
          @tokenselected="requestClose"
        />
      </template>
    </Modal>

    <FatInfoTable :show="nextStepAllowed" data-handle="pool-prices">
      <template #header>Pool Token Prices</template>
      <template #body>
        <FatInfoTableCell data-handle="pool-prices-forward">
          <span class="number" data-handle="pool-prices-forward-number">{{
            formatNumber(aPerBRatioMessage === "N/A" ? "0" : aPerBRatioMessage)
          }}</span
          ><br />
          <span data-handle="pool-prices-forward-symbols"
            >{{
              fromSymbol.toLowerCase().includes("rowan")
                ? fromSymbol.toUpperCase()
                : "c" + fromSymbol.slice(1).toUpperCase()
            }}
            per
            {{
              toSymbol.toLowerCase().includes("rowan")
                ? toSymbol.toUpperCase()
                : "c" + toSymbol.slice(1).toUpperCase()
            }}</span
          >
        </FatInfoTableCell>
        <FatInfoTableCell data-handle="pool-prices-backward">
          <span class="number" data-handle="pool-prices-backward-number">{{
            formatNumber(bPerARatioMessage === "N/A" ? "0" : bPerARatioMessage)
          }}</span
          ><br />
          <span data-handle="pool-prices-backward-symbols"
            >{{
              toSymbol.toLowerCase().includes("rowan")
                ? toSymbol.toUpperCase()
                : "c" + toSymbol.slice(1).toUpperCase()
            }}
            per
            {{
              fromSymbol.toLowerCase().includes("rowan")
                ? fromSymbol.toUpperCase()
                : "c" + fromSymbol.slice(1).toUpperCase()
            }}</span
          > </FatInfoTableCell
        ><FatInfoTableCell />
      </template>
    </FatInfoTable>

    <FatInfoTable
      :status="riskFactorStatus"
      :show="nextStepAllowed"
      data-handle="pool-estimates"
    >
      <template #header>
        <div class="pool-ratio-label">
          <span>Est. prices after pooling & pool share</span>
          <Tooltip v-if="!asyncPooling && riskFactorStatus !== ''">
            <template #message>
              This is an asymmetric liquidity add that has an estimated large
              impact on this pool, and therefore a significant slip adjustment.
              Please be aware of how this works by reading our documentation
              <a
                href="https://docs.sifchain.finance/core-concepts/liquidity-pool#asymmetric-liquidity-pool"
                target="_blank"
                >here</a
              >.
            </template>
            <Icon
              v-bind:class="{ [`icon-risk-status-${riskFactorStatus}`]: true }"
              icon="exclaimation"
            />
          </Tooltip>
        </div>
      </template>
      <template #body>
        <FatInfoTableCell data-handle="pool-estimates-forwards">
          <span class="number" data-handle="pool-estimates-forwards-number">{{
            formatNumber(
              aPerBRatioProjectedMessage === "N/A"
                ? "0"
                : aPerBRatioProjectedMessage,
            )
          }}</span
          ><br />
          <span data-handle="pool-estimates-forwards-symbols"
            >{{ fromSymbol.toUpperCase() }} per
            {{ toSymbol.toUpperCase() }}</span
          >
        </FatInfoTableCell>
        <FatInfoTableCell data-handle="pool-estimates-backwards">
          <span class="number" data-handle="pool-estimates-backwards-number">{{
            formatNumber(
              bPerARatioProjectedMessage === "N/A"
                ? "0"
                : bPerARatioProjectedMessage,
            )
          }}</span
          ><br />
          <span data-handle="pool-estimates-backwards-symbols"
            >{{ toSymbol.toUpperCase() }} per
            {{ fromSymbol.toUpperCase() }}</span
          >
        </FatInfoTableCell>
        <FatInfoTableCell data-handle="pool-estimates-share">
          <span class="number" data-handle="pool-estimates-share-number">{{
            shareOfPoolPercent
          }}</span
          ><br />Share of Pool
        </FatInfoTableCell></template
      >
    </FatInfoTable>

    <ActionsPanel
      @nextstepclick="handleNextStepClicked"
      :nextStepAllowed="nextStepAllowed"
      :nextStepMessage="nextStepMessage"
    />
    <ConfirmationModal
      :requestClose="requestTransactionModalClose"
      @confirmed="handleAskConfirmClicked"
      :state="transactionState"
      :transactionHash="transactionHash"
      :transactionStateMsg="transactionStateMsg"
      confirmButtonText="Confirm Supply"
      title="You are depositing"
    >
      <template v-slot:selecting>
        <div>
          <DetailsPanelPool
            class="details"
            :fromTokenLabel="fromSymbol"
            :fromAmount="fromAmount"
            :toTokenLabel="toSymbol"
            :toAmount="toAmount"
            :aPerB="aPerBRatioMessage"
            :bPerA="bPerARatioMessage"
            :shareOfPool="shareOfPoolPercent"
          />
        </div>
      </template>

      <template v-slot:common>
        <p class="text--normal" data-handle="confirmation-wait-message">
          Supplying
          <span class="text--bold">{{ fromAmount }} {{ fromSymbol }}</span>
          and
          <span class="text--bold">{{ toAmount }} {{ toSymbol }}</span>
        </p>
      </template>
    </ConfirmationModal>
  </Layout>
</template>

<style lang="scss" scoped>
.number {
  font-size: 16px;
  font-weight: bold;
}
.pool-ratio-label {
  display: flex;
  justify-content: space-between;
}

.icon-risk-status-bad::v-deep {
  path,
  circle,
  rect {
    fill: #cccc0e !important;
  }
}
.icon-risk-status-warning::v-deep {
  path,
  circle,
  rect {
    fill: orange !important;
  }
}
.icon-risk-status-danger::v-deep {
  path,
  circle,
  rect {
    fill: red !important;
  }
}
</style>
