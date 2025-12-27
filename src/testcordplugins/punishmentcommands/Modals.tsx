import ErrorBoundary from "@components/ErrorBoundary";
import { openModal, ModalRoot, ModalSize, ModalHeader, ModalCloseButton, ModalContent, closeModal, closeAllModals } from "@utils/modal";
import { Button, Forms, Parser, TextInput } from "@webpack/common";
import { cl } from "plugins/memberCount";
import { SelectedChannelStore, useState } from "@webpack/common";
import "./style.css";
import { sendMessage } from "@utils/discord";

export function showPrefefinedDurationModal(duration: string, id: string) {
    let reason = "";
    openModal(props =>
        <>
            <ErrorBoundary>
                <ModalRoot {...props} size={ModalSize.DYNAMIC} fullscreenOnMobile={true} >
                    <ModalHeader className={cl("header")}>
                        <Forms.FormText style={{ fontSize: "1.2rem", fontWeight: "bold", marginRight: "7px" }}>Mute user</Forms.FormText>
                    </ModalHeader>
                    <ModalContent>
                        <TextInput onChange={v => { reason = v; }} placeholder="Reason" className="vc-punishcommands-reason" />
                        <div className="vc-punishcommands-button-container">
                            <Button color={Button.Colors.RED} onClick={() => {
                                sendMessage(SelectedChannelStore.getChannelId(), { content: `+Cg ${id} ${duration} ${reason}` });
                                closeAllModals();
                            }}>Mute</Button>
                        </div>
                    </ModalContent>
                </ModalRoot>
            </ErrorBoundary>
        </>
    );
}
export function showCustomDurationModal(id: string) {
    let duration = "";
    let reason = "";
    let pendingSend = false;
    openModal(props =>
        <>
            <ErrorBoundary>
                <ModalRoot {...props} size={ModalSize.DYNAMIC} fullscreenOnMobile={true} >
                    <ModalHeader className={cl("header")}>
                        <Forms.FormText style={{ fontSize: "1.2rem", fontWeight: "bold", marginRight: "7px" }}>Mute user</Forms.FormText>
                    </ModalHeader>
                    <ModalContent>
                        <TextInput onChange={v => { duration = v; }} placeholder="Duration (as written in the command)" className="vc-punishcommands-duration-c" />
                        <TextInput onChange={v => { reason = v; }} placeholder="Reason" className="vc-punishcommands-reason-c" />
                        <div className="vc-punishcommands-button-container">
                            <Button color={Button.Colors.RED} onClick={() => {
                                if (pendingSend) return;
                                pendingSend = true;
                                sendMessage(SelectedChannelStore.getChannelId(), { content: `+Cg ${id} ${duration} ${reason}` });
                                closeAllModals();
                            }}>Mute</Button>
                        </div>
                    </ModalContent>
                </ModalRoot>
            </ErrorBoundary>
        </>
    );
}
