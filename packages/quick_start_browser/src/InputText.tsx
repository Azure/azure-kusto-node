import { Field, Input } from "@fluentui/react-components";

export const checkMark = String.fromCharCode(10003);
interface TextProps {
    required?: boolean;
    label: string;
    onChange: (p: any, data: any) => void;
    value?: string;
    defaultValue?: string;
    maxWidth?: number;
    error?: string;
    disabled?: boolean;
}
export const RowAligned: React.FC<{ children: React.ReactNode }> = (props) => {
    return (
        <div
            style={{
                display: "flex",
                flexDirection: "row",
            }}
            className="fields"
        >
            {props.children}
        </div>
    );
};

export const InputText: React.FunctionComponent<TextProps> = (props) => {
    return (
        <RowAligned>
            <Field
                validationState={props.error ? "error" : "none"}
                required={props.required}
                orientation="horizontal"
                label={props.label}
                validationMessage={props.error}
                style={{ width: 400, marginBottom: 5 }}
            >
                <Input
                    disabled={props.disabled}
                    style={{ outlineStyle: "auto", paddingLeft: 5, maxWidth: props.maxWidth || 400 }}
                    onChange={(p, v) => {
                        props.onChange(p, v.value);
                    }}
                    value={props.value}
                    defaultValue={props.defaultValue}
                />
            </Field>
        </RowAligned>
    );
};
