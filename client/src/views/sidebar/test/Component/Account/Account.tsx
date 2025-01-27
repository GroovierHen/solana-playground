import { FC, useState } from "react";
import styled, { css } from "styled-components";
import { PublicKey } from "@solana/web3.js";

import CodeResult from "../CodeResult";
import InputLabel from "../InputLabel";
import Button from "../../../../../components/Button";
import Foldable from "../../../../../components/Foldable";
import SearchBar from "../../../../../components/SearchBar";
import Text from "../../../../../components/Text";
import { SpinnerWithBg } from "../../../../../components/Loading";
import { PgCommon } from "../../../../../utils/pg";
import { PgProgramInteraction } from "../../../../../utils/pg/program-interaction";
import { useWallet } from "../../../../../hooks";

interface AccountProps {
  accountName: string;
  index: number;
}

const Account: FC<AccountProps> = ({ accountName, index }) => {
  const [enteredAddress, setEnteredAddress] = useState("");
  const [enteredAddressError, setEnteredAddressError] = useState(false);
  const [fetchedData, setFetchedData] = useState<object>();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchOneLoading, setFetchOneLoading] = useState(false);
  const [fetchAllLoading, setFetchAllLoading] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  const { wallet } = useWallet();

  const handleFetched = (data: object) => {
    setFetchedData(data);
    setFetchError(null);
    setResultOpen(true);
  };

  const handleError = (e: any) => {
    if (e.message.startsWith("Account does not exist")) {
      setFetchError("Account does not exist");
    } else if (e.message === "Invalid account discriminator") {
      setFetchError(`Given account is not type ${accountName}`);
    } else {
      console.log(e);
      setFetchError(`Unknown error: ${e.message}`);
    }

    setResultOpen(true);
  };

  const fetchOne = async () => {
    setFetchOneLoading(true);
    try {
      const account = await PgCommon.transition(
        PgProgramInteraction.fetchAccount(
          accountName,
          new PublicKey(enteredAddress)
        )
      );
      handleFetched(account);
    } catch (err: any) {
      handleError(err);
    } finally {
      setFetchOneLoading(false);
    }
  };

  const fetchAll = async () => {
    setFetchAllLoading(true);
    try {
      const allAccounts = await PgCommon.transition(
        PgProgramInteraction.fetchAllAccounts(accountName)
      );
      handleFetched(allAccounts);
    } catch (err: any) {
      handleError(err);
    } finally {
      setFetchAllLoading(false);
    }
  };

  return (
    <AccountWrapper index={index}>
      <Foldable element={<AccountName>{accountName}</AccountName>}>
        <InputWrapper>
          <InputLabel name="address" type="publicKey" />
          <SearchBar
            value={enteredAddress}
            onChange={(ev) => setEnteredAddress(ev.target.value)}
            error={enteredAddressError}
            setError={setEnteredAddressError}
            validator={PgCommon.isPk}
          />
        </InputWrapper>

        <ButtonsWrapper>
          <Button
            onClick={fetchOne}
            disabled={!wallet || !enteredAddress || enteredAddressError}
          >
            Fetch
          </Button>
          <Button onClick={fetchAll} disabled={!wallet}>
            Fetch All
          </Button>
        </ButtonsWrapper>

        {(fetchedData || fetchError) && (
          <ResultWrapper>
            <Foldable
              element={<span>Result</span>}
              isOpen={resultOpen}
              setIsOpen={setResultOpen}
            >
              <SpinnerWithBg loading={fetchOneLoading || fetchAllLoading}>
                {fetchError ? (
                  <FetchError kind="error">{fetchError}</FetchError>
                ) : (
                  <CodeResult index={index}>
                    {PgCommon.prettyJSON(fetchedData!)}
                  </CodeResult>
                )}
              </SpinnerWithBg>
            </Foldable>
          </ResultWrapper>
        )}
      </Foldable>
    </AccountWrapper>
  );
};

interface IndexProp {
  index: number;
}

const AccountWrapper = styled.div<IndexProp>`
  ${({ theme, index }) => css`
    padding: 1rem;
    border-top: 1px solid ${theme.colors.default.border};
    background: ${index % 2 === 0 &&
    theme.components.sidebar.right.default.otherBg};

    &:last-child {
      border-bottom: 1px solid ${theme.colors.default.border};
    }
  `}
`;

const AccountName = styled.span`
  font-weight: bold;
`;

const InputWrapper = styled.div`
  margin: 0.5rem 0;
`;

const ButtonsWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 0.75rem;
`;

const ResultWrapper = styled.div`
  margin-top: 1rem;
  width: 100%;
`;

const FetchError = styled(Text)`
  width: 100%;
`;

export default Account;
