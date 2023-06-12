import axios from "axios";
import { log_server } from "./util";

const SERVER_URL = "https://bandallgom.com:8000/api/"

export const getFileInfo = async (fileId) => {
    let res;
    try {
        axios.defaults.withCredentials = true;
        const url = SERVER_URL + "file-info/" + fileId;
        res = await axios.get(url);
        if (res.data.hasFile) {
            return res.data.fileMetadata.originalFileName;
        } else {
            return fileId;
        }
    } catch (error) {
        log_server(error);
        return fileId;
    }
}