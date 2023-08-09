import { Icon, Link, Text } from "@fluentui/react";
import { DocumentIcon, UploadIcon } from '@fluentui/react-icons-mdl2';
import { registerIcons } from '@fluentui/react/lib/Styling';
import React from "react";
import { useDropzone } from "react-dropzone";

registerIcons({
    icons: {
      upload: <UploadIcon />,
      doc: <DocumentIcon />
    }
  });

interface BrowseFilesProps{
    setFile: (file: File) => void,
    fileName: string | undefined
}

export const BrowseFiles: React.FunctionComponent<BrowseFilesProps> = ({setFile, fileName}) => {
    const { getInputProps, getRootProps } = useDropzone({
        onDrop: (files: File[], _rejected, _event) => {
            console.log(files);
            setFile(files[0])
        },
    });
    return (
        <div style={{padding:20}}
            >
            {!fileName ? 
            (<div
            {...(getRootProps() )}
            style={{
                borderStyle: 'solid',
                borderWidth: 1,
                position: 'relative',
                width: 158,
                height: 133,
                }}
            >
            <input {...getInputProps()} />
            <div style={ { margin: 'auto', alignItems: 'center', flexDirection:"column", display:"flex" } }>
                <Icon style={{marginBottom:10}}
                    iconName="upload"
                    styles={{ root: { width: 42, height: 31, fontSize: 42, paddingBottom: 28 } }}
                />
                <Text style={{color:"white"}} >Drop files here</Text>
                <Link>Drop or browse</Link>
            </div>    
            </div>)
             : (<Icon style={{marginBottom:10}}
                            iconName="doc"
                            styles={{ root: { width: 42, height: 31, fontSize: 42, paddingBottom: 28 } }}
                />)}
        </div>
    )
}