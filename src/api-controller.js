import axios from "axios";
import * as https from "https";
import { log_server } from "./util";

const SERVER_URL = "https://bandallgom.com:8000/api/"
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
})
export const getFileInfo = async (fileId) => {
    let res;
    try {
        axios.defaults.withCredentials = true;
        const url = SERVER_URL + "file-info/" + fileId;
        res = await axios.get(url, { httpsAgent });
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
