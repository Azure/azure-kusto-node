// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { Link } from "@fluentui/react";
import { ArrowUpload16Regular, DocumentMultiple20Regular } from "@fluentui/react-icons";
import React from "react";
import { useDropzone } from "react-dropzone";

interface BrowseFilesProps {
    setFile: (file: File) => void;
    fileName: string | undefined;
}

export const BrowseFiles: React.FunctionComponent<BrowseFilesProps> = ({ setFile, fileName }) => {
    const { getInputProps, getRootProps } = useDropzone({
        onDrop: (files: File[], _rejected, _event) => {
            console.log(files);
            setFile(files[0]);
        },
    });
    return (
        <div style={{ padding: 20 }}>
            {!fileName ? (
                <div
                    {...getRootProps()}
                    style={{
                        borderStyle: "solid",
                        borderWidth: 1,
                        position: "relative",
                        width: 158,
                        height: 133,
                    }}
                >
                    <input {...getInputProps()} />
                    <div style={{ margin: "auto", alignItems: "center", flexDirection: "column", display: "flex" }}>
                        <ArrowUpload16Regular style={{ height: 65, width: 65, marginBottom: 10 }} />
                        <Link>Drop or browse</Link>
                    </div>
                </div>
            ) : (
                <DocumentMultiple20Regular style={{ height: 75, width: 75 }} />
            )}
        </div>
    );
};
