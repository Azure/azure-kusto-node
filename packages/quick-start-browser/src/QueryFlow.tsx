import { Button, Spinner, Text } from "@fluentui/react-components";
import { Client, KustoResponseDataSet } from "azure-kusto-data";
import React from "react";
import { ResultTable } from "./ResultTable";

interface QueryFlowProps{
    queryClient: Client|null,
    table: string,
    database: string,
    useExistingTable: boolean,
    tableCreated: boolean
}

interface QueryFlowState {
  res?: KustoResponseDataSet;
  err?: Error;
  ongoing?: boolean;
}

export const QueryFlow: React.FunctionComponent<QueryFlowProps> = ({queryClient, useExistingTable, tableCreated, table, database}) => {
  const [state, setState] = React.useState<QueryFlowState>({})
    return (
           <div
          style={{paddingTop:20, paddingBottom:60}}
        >
          {state.ongoing ? <><Spinner></Spinner><p>Running query...</p></> : 
          <Button 
            appearance="primary" disabled={!queryClient || (!useExistingTable && !tableCreated)}
            onClick={() => {
                setState({ongoing: true})
                queryClient?.execute(database, table + "| take 10")
                .then((res) => {
                  setState({res})
                }).catch((err) => {
                  setState({err}) 
                })
          }} >
            Run Query ({table + "| take 10"})
          </Button>}
          
          {state.res && (<div
          //  style={{ paddingTop: 30 }}
           >
            <ResultTable
              resultTable={state.res.primaryResults[0]}
            />
          </div>)}
          <div>
            {state.err && <Text style={{color:"#e37d80"}}>
              {`Error ${(state.err as any).response?.data?.error?.code ?? ""}: ${(state.err as any).response?.data?.error["@message"] ?? state.err.message}`}
              </Text>}
          </div>
        </div>
    )
}